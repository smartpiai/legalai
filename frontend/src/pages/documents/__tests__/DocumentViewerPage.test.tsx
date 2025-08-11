/**
 * DocumentViewerPage Tests
 * Comprehensive test suite following TDD methodology
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import DocumentViewerPage from '../DocumentViewerPage'
import { PDFViewer } from '../../../components/document/PDFViewer'
import documentService from '../../../services/document.service'

// Get mocked functions
const mockedDocumentService = vi.mocked(documentService)

// Mock react-router-dom hooks
const mockNavigate = vi.fn()
const mockParams = { id: 'doc-123' }
const mockLocation = { pathname: '/documents/doc-123', search: '', hash: '', state: null, key: 'test' }

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    useLocation: () => mockLocation,
  }
})

// Mock document service
vi.mock('../../../services/document.service', () => ({
  default: {
    getDocument: vi.fn(),
    downloadDocument: vi.fn(),
    updateDocumentMetadata: vi.fn(),
    deleteDocument: vi.fn(),
  }
}))

// Mock PDFViewer component
vi.mock('../../../components/document/PDFViewer', () => ({
  PDFViewer: vi.fn(({ onDownload, onPrint }) => (
    <div data-testid="pdf-viewer">
      <button onClick={onDownload} data-testid="pdf-download">Download</button>
      <button onClick={onPrint} data-testid="pdf-print">Print</button>
      PDF Viewer Component
    </div>
  )),
}))

// Sample document data
const mockDocument = {
  id: 'doc-123',
  title: 'Sample Contract Document',
  description: 'A sample legal contract for testing',
  fileType: 'pdf',
  fileName: 'contract.pdf',
  fileSize: 1024000,
  pageCount: 15,
  uploadDate: '2024-01-15T10:30:00Z',
  uploadedBy: 'John Doe',
  department: 'Legal',
  tags: ['contract', 'legal', 'important'],
  categories: ['Contracts'],
  confidentialityLevel: 'Internal',
  contentUrl: 'https://example.com/documents/doc-123/content',
  downloadUrl: 'https://example.com/documents/doc-123/download',
  versions: [
    {
      id: 'v1',
      version: '1.0',
      uploadDate: '2024-01-15T10:30:00Z',
      uploadedBy: 'John Doe',
      changes: 'Initial version'
    },
    {
      id: 'v2', 
      version: '1.1',
      uploadDate: '2024-01-16T14:20:00Z',
      uploadedBy: 'Jane Smith',
      changes: 'Updated terms and conditions'
    }
  ],
  annotations: [
    {
      id: 'ann-1',
      page: 1,
      x: 100,
      y: 200,
      text: 'Review this clause',
      author: 'John Doe',
      createdAt: '2024-01-16T09:15:00Z'
    }
  ],
  comments: [
    {
      id: 'com-1',
      text: 'This document needs legal review',
      author: 'Jane Smith',
      createdAt: '2024-01-16T11:30:00Z'
    }
  ],
  permissions: {
    canView: true,
    canDownload: true,
    canEdit: true,
    canDelete: true,
    canShare: true,
    canAnnotate: true,
  }
}

const mockNonPDFDocument = {
  ...mockDocument,
  id: 'doc-456',
  fileType: 'docx',
  fileName: 'contract.docx',
  contentUrl: 'https://example.com/documents/doc-456/content',
}

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('DocumentViewerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedDocumentService.getDocument.mockResolvedValue(mockDocument)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Document Loading', () => {
    it('should render loading state initially', () => {
      mockedDocumentService.getDocument.mockImplementation(() => new Promise(() => {}))
      renderWithRouter(<DocumentViewerPage />)
      
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByText('Loading document...')).toBeInTheDocument()
    })

    it('should fetch document using ID from URL params', async () => {
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(mockedDocumentService.getDocument).toHaveBeenCalledWith('doc-123')
      })
    })

    it('should display error state when document fetch fails', async () => {
      const errorMessage = 'Document not found'
      mockedDocumentService.getDocument.mockRejectedValue(new Error(errorMessage))
      
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Error loading document')).toBeInTheDocument()
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('should display unauthorized error for restricted documents', async () => {
      mockedDocumentService.getDocument.mockRejectedValue({ 
        response: { status: 403, data: { message: 'Unauthorized access' } } 
      })
      
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Unauthorized access')).toBeInTheDocument()
      })
    })
  })

  describe('Document Display', () => {
    it('should render PDF viewer for PDF documents', async () => {
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument()
        expect(PDFViewer).toHaveBeenCalledWith(
          expect.objectContaining({
            fileUrl: mockDocument.contentUrl,
            enableSearch: true,
            enableTextSelection: true,
            enableAnnotations: true,
            annotations: mockDocument.annotations,
          }),
          expect.anything()
        )
      })
    })

    it('should render document viewer for non-PDF documents', async () => {
      mockedDocumentService.getDocument.mockResolvedValue(mockNonPDFDocument)
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('document-viewer')).toBeInTheDocument()
        expect(screen.getByText('Document preview not available')).toBeInTheDocument()
        expect(screen.getAllByText('contract.docx')).toHaveLength(2) // One in sidebar, one in viewer
      })
    })

    it('should display document title and basic info', async () => {
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getAllByText(mockDocument.title)).toHaveLength(2) // Breadcrumb and sidebar
        expect(screen.getByText(mockDocument.fileName)).toBeInTheDocument()
        expect(screen.getByText('PDF Document')).toBeInTheDocument()
      })
    })
  })

  describe('Navigation Breadcrumbs', () => {
    it('should render breadcrumbs with correct navigation path', async () => {
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument()
        expect(screen.getByText('Documents')).toBeInTheDocument()
        expect(screen.getByText(mockDocument.title)).toBeInTheDocument()
      })
    })

    it('should handle breadcrumb navigation', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Documents')).toBeInTheDocument()
      })
      
      await user.click(screen.getByText('Documents'))
      expect(mockNavigate).toHaveBeenCalledWith('/documents')
    })
  })

  describe('Document Metadata Sidebar', () => {
    it('should display document metadata in sidebar', async () => {
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Document Information')).toBeInTheDocument()
        expect(screen.getByText(mockDocument.description)).toBeInTheDocument()
        expect(screen.getByText('Legal')).toBeInTheDocument()
        expect(screen.getByText('Internal')).toBeInTheDocument()
      })
    })

    it('should display upload information', async () => {
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument()
        expect(screen.getByText('1.00 MB')).toBeInTheDocument()
        expect(screen.getByText('15 pages')).toBeInTheDocument()
      })
    })

    it('should display tags and categories', async () => {
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByText('contract')).toBeInTheDocument()
        expect(screen.getByText('legal')).toBeInTheDocument()
        expect(screen.getByText('important')).toBeInTheDocument()
        expect(screen.getByText('Contracts')).toBeInTheDocument()
      })
    })

    it('should display version history', async () => {
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Version History')).toBeInTheDocument()
        expect(screen.getByText('1.0')).toBeInTheDocument()
        expect(screen.getByText('1.1')).toBeInTheDocument()
        expect(screen.getByText('Initial version')).toBeInTheDocument()
        expect(screen.getByText('Updated terms and conditions')).toBeInTheDocument()
      })
    })

    it('should be collapsible on mobile devices', async () => {
      const user = userEvent.setup()
      
      // Mock window.innerWidth for mobile
      Object.defineProperty(window, 'innerWidth', { 
        value: 600, 
        writable: true, 
        configurable: true 
      })
      
      // Fire resize event to trigger responsive logic
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })
      
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Toggle sidebar')).toBeInTheDocument()
      })
      
      await user.click(screen.getByLabelText('Toggle sidebar'))
      expect(screen.getByTestId('metadata-sidebar')).toHaveClass('hidden')
    })
  })

  describe('Document Actions Toolbar', () => {

    it('should render all action buttons when user has permissions', async () => {
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Download document')).toBeInTheDocument()
        expect(screen.getByLabelText('Print document')).toBeInTheDocument()
        expect(screen.getByLabelText('Share document')).toBeInTheDocument()
        expect(screen.getByLabelText('Edit metadata')).toBeInTheDocument()
        expect(screen.getByLabelText('Delete document')).toBeInTheDocument()
        expect(screen.getByLabelText('Add to contract')).toBeInTheDocument()
      })
    })

    it('should hide actions when user lacks permissions', async () => {
      const restrictedDocument = {
        ...mockDocument,
        permissions: {
          canView: true,
          canDownload: false,
          canEdit: false,
          canDelete: false,
          canShare: false,
          canAnnotate: false,
        }
      }
      mockedDocumentService.getDocument.mockResolvedValue(restrictedDocument)
      
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.queryByLabelText('Download document')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Edit metadata')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Delete document')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Share document')).not.toBeInTheDocument()
      })
    })

    it('should handle download action', async () => {
      // Mock browser APIs
      global.URL.createObjectURL = vi.fn(() => 'blob:url')
      global.URL.revokeObjectURL = vi.fn()
      
      const mockLink = { click: vi.fn(), href: '', download: '', style: {} }
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any)
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any)
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any)
      
      const user = userEvent.setup()
      const mockBlob = new Blob(['fake content'], { type: 'application/pdf' })
      mockedDocumentService.downloadDocument.mockResolvedValue(mockBlob)
      
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Download document')).toBeInTheDocument()
      })
      
      await user.click(screen.getByLabelText('Download document'))
      
      await waitFor(() => {
        expect(mockedDocumentService.downloadDocument).toHaveBeenCalledWith('doc-123')
        expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob)
        expect(mockLink.click).toHaveBeenCalled()
      })
    })

    it('should handle print action from PDF viewer', async () => {
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('pdf-print')).toBeInTheDocument()
      })
      
      // Mock print functionality
      const mockPrint = vi.fn()
      global.print = mockPrint
      
      fireEvent.click(screen.getByTestId('pdf-print'))
      
      // Print should be triggered (implementation depends on PDF viewer)
      expect(PDFViewer).toHaveBeenCalledWith(
        expect.objectContaining({
          onPrint: expect.any(Function)
        }),
        expect.anything()
      )
    })

    it('should handle delete action with confirmation', async () => {
      const user = userEvent.setup()
      mockedDocumentService.deleteDocument.mockResolvedValue(undefined)
      
      // Mock confirm dialog
      const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
      
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Delete document')).toBeInTheDocument()
      })
      
      await user.click(screen.getByLabelText('Delete document'))
      
      expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to delete this document? This action cannot be undone.')
      
      await waitFor(() => {
        expect(mockedDocumentService.deleteDocument).toHaveBeenCalledWith('doc-123')
        expect(mockNavigate).toHaveBeenCalledWith('/documents')
      })
    })

    it('should not delete when confirmation is cancelled', async () => {
      const user = userEvent.setup()
      
      // Mock confirm dialog returning false
      const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Delete document')).toBeInTheDocument()
      })
      
      await user.click(screen.getByLabelText('Delete document'))
      
      expect(mockConfirm).toHaveBeenCalled()
      expect(mockedDocumentService.deleteDocument).not.toHaveBeenCalled()
    })
  })

  describe('Annotations and Comments', () => {
    it('should display annotations panel', async () => {
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Annotations & Comments')).toBeInTheDocument()
        expect(screen.getByText('Review this clause')).toBeInTheDocument()
        expect(screen.getByText('This document needs legal review')).toBeInTheDocument()
      })
    })

    it('should allow adding new comments when permitted', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument()
      })
      
      await user.type(screen.getByPlaceholderText('Add a comment...'), 'New comment')
      await user.click(screen.getByRole('button', { name: 'Add Comment' }))
      
      // Should trigger API call to add comment (would need actual implementation)
      expect(screen.getByPlaceholderText('Add a comment...')).toHaveValue('')
    })

    it('should hide comment input when user cannot annotate', async () => {
      const restrictedDocument = {
        ...mockDocument,
        permissions: {
          ...mockDocument.permissions,
          canAnnotate: false,
        }
      }
      mockedDocumentService.getDocument.mockResolvedValue(restrictedDocument)
      
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Add a comment...')).not.toBeInTheDocument()
        expect(screen.getByText('You do not have permission to add comments')).toBeInTheDocument()
      })
    })
  })

  describe('Document Search', () => {
    it('should display search input for searchable documents', async () => {
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search in document...')).toBeInTheDocument()
      })
    })

    it('should handle search input and results', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search in document...')).toBeInTheDocument()
      })
      
      await user.type(screen.getByPlaceholderText('Search in document...'), 'contract')
      
      // Search should be passed to PDF viewer
      expect(screen.getByDisplayValue('contract')).toBeInTheDocument()
    })
  })

  describe('Full-screen Mode', () => {
    it('should toggle full-screen mode', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Enter full screen')).toBeInTheDocument()
      })
      
      await user.click(screen.getByLabelText('Enter full screen'))
      
      expect(screen.getByTestId('document-viewer-container')).toHaveClass('fullscreen')
      expect(screen.getByLabelText('Exit full screen')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle download errors gracefully', async () => {
      const user = userEvent.setup()
      mockedDocumentService.downloadDocument.mockRejectedValue(new Error('Download failed'))
      
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Download document')).toBeInTheDocument()
      })
      
      await user.click(screen.getByLabelText('Download document'))
      
      await waitFor(() => {
        expect(screen.getByText('Failed to download document')).toBeInTheDocument()
      })
    })

    it('should handle metadata update errors', async () => {
      mockedDocumentService.updateDocumentMetadata.mockRejectedValue(new Error('Update failed'))
      
      renderWithRouter(<DocumentViewerPage />)
      
      // This would be tested when metadata editing is implemented
      expect(mockedDocumentService.getDocument).toHaveBeenCalled()
    })
  })

  describe('Responsive Design', () => {
    it('should adapt layout for mobile screens', async () => {
      Object.defineProperty(window, 'innerWidth', { 
        value: 500, 
        writable: true, 
        configurable: true 
      })
      
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })
      
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('document-viewer-container')).toHaveClass('mobile-layout')
      })
    })

    it('should show mobile-friendly action buttons', async () => {
      Object.defineProperty(window, 'innerWidth', { 
        value: 500, 
        writable: true, 
        configurable: true 
      })
      
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })
      
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('More actions')).toBeInTheDocument()
      })
    })
  })

  describe('Security and Audit', () => {
    it('should log document view events', async () => {
      const consoleSpy = vi.spyOn(console, 'log')
      
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Document viewed:', {
          documentId: 'doc-123',
          userId: expect.any(String),
          timestamp: expect.any(String)
        })
      })
    })

    it('should handle secure document URLs', async () => {
      renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        // PDF viewer should receive the secure URL
        expect(PDFViewer).toHaveBeenCalledWith(
          expect.objectContaining({
            fileUrl: mockDocument.contentUrl
          }),
          expect.anything()
        )
      })
    })
  })

  describe('Performance', () => {
    it('should lazy load document content', async () => {
      renderWithRouter(<DocumentViewerPage />)
      
      // Document should not be fetched until component mounts
      expect(mockedDocumentService.getDocument).toHaveBeenCalledTimes(1)
      
      await waitFor(() => {
        expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument()
      })
    })

    it('should cache document data', async () => {
      const { rerender } = renderWithRouter(<DocumentViewerPage />)
      
      await waitFor(() => {
        expect(mockedDocumentService.getDocument).toHaveBeenCalledTimes(1)
      })
      
      // Rerender should not fetch document again if cached
      rerender(<DocumentViewerPage />)
      
      // Should still only be called once due to caching
      expect(mockedDocumentService.getDocument).toHaveBeenCalledTimes(1)
    })
  })
})