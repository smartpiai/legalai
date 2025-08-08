/**
 * Tests for QuickActionButtons component
 * Following TDD approach - tests written first
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickActionButtons } from './QuickActionButtons'

// Mock selected contracts data
const mockSelectedContracts = [
  { id: '1', title: 'Service Agreement', status: 'active', type: 'service' },
  { id: '2', title: 'NDA Agreement', status: 'draft', type: 'nda' },
  { id: '3', title: 'Master Agreement', status: 'pending_review', type: 'master' }
]

describe('QuickActionButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic rendering', () => {
    it('should render create new contract button by default', () => {
      render(<QuickActionButtons />)
      
      expect(screen.getByText('New Contract')).toBeInTheDocument()
      expect(screen.getByTestId('new-contract-button')).toBeInTheDocument()
    })

    it('should render all primary action buttons when no contracts selected', () => {
      render(<QuickActionButtons />)
      
      expect(screen.getByText('New Contract')).toBeInTheDocument()
      expect(screen.getByText('Upload Document')).toBeInTheDocument()
      expect(screen.getByText('Import Templates')).toBeInTheDocument()
      expect(screen.getByText('Generate Report')).toBeInTheDocument()
    })

    it('should show correct icons for each action', () => {
      render(<QuickActionButtons />)
      
      expect(screen.getByTestId('new-contract-icon')).toBeInTheDocument()
      expect(screen.getByTestId('upload-document-icon')).toBeInTheDocument()
      expect(screen.getByTestId('import-templates-icon')).toBeInTheDocument()
      expect(screen.getByTestId('generate-report-icon')).toBeInTheDocument()
    })
  })

  describe('Selection-based actions', () => {
    it('should show bulk action buttons when contracts are selected', () => {
      render(
        <QuickActionButtons 
          selectedContracts={mockSelectedContracts} 
          selectedCount={3}
        />
      )
      
      expect(screen.getByText('Bulk Actions')).toBeInTheDocument()
      expect(screen.getByText('3 selected')).toBeInTheDocument()
    })

    it('should show bulk action dropdown menu', async () => {
      const user = userEvent.setup()
      render(
        <QuickActionButtons 
          selectedContracts={mockSelectedContracts} 
          selectedCount={3}
        />
      )
      
      await user.click(screen.getByTestId('bulk-actions-dropdown'))
      
      expect(screen.getByText('Change Status')).toBeInTheDocument()
      expect(screen.getByText('Export Selected')).toBeInTheDocument()
      expect(screen.getByText('Delete Selected')).toBeInTheDocument()
      expect(screen.getByText('Archive Selected')).toBeInTheDocument()
    })

    it('should hide primary actions when contracts are selected', () => {
      render(
        <QuickActionButtons 
          selectedContracts={mockSelectedContracts} 
          selectedCount={3}
        />
      )
      
      expect(screen.queryByText('New Contract')).not.toBeInTheDocument()
      expect(screen.queryByText('Upload Document')).not.toBeInTheDocument()
    })

    it('should show correct count in selection indicator', () => {
      const { rerender } = render(
        <QuickActionButtons selectedCount={1} />
      )
      expect(screen.getByText('1 selected')).toBeInTheDocument()
      
      rerender(<QuickActionButtons selectedCount={5} />)
      expect(screen.getByText('5 selected')).toBeInTheDocument()
    })
  })

  describe('Action handlers', () => {
    it('should call onNewContract when new contract button is clicked', async () => {
      const user = userEvent.setup()
      const onNewContract = vi.fn()
      
      render(<QuickActionButtons onNewContract={onNewContract} />)
      
      await user.click(screen.getByTestId('new-contract-button'))
      expect(onNewContract).toHaveBeenCalledTimes(1)
    })

    it('should call onUploadDocument when upload button is clicked', async () => {
      const user = userEvent.setup()
      const onUploadDocument = vi.fn()
      
      render(<QuickActionButtons onUploadDocument={onUploadDocument} />)
      
      await user.click(screen.getByText('Upload Document'))
      expect(onUploadDocument).toHaveBeenCalledTimes(1)
    })

    it('should call onImportTemplates when import button is clicked', async () => {
      const user = userEvent.setup()
      const onImportTemplates = vi.fn()
      
      render(<QuickActionButtons onImportTemplates={onImportTemplates} />)
      
      await user.click(screen.getByText('Import Templates'))
      expect(onImportTemplates).toHaveBeenCalledTimes(1)
    })

    it('should call onGenerateReport when report button is clicked', async () => {
      const user = userEvent.setup()
      const onGenerateReport = vi.fn()
      
      render(<QuickActionButtons onGenerateReport={onGenerateReport} />)
      
      await user.click(screen.getByText('Generate Report'))
      expect(onGenerateReport).toHaveBeenCalledTimes(1)
    })
  })

  describe('Bulk action handlers', () => {
    it('should call onBulkStatusChange when status change is selected', async () => {
      const user = userEvent.setup()
      const onBulkStatusChange = vi.fn()
      
      render(
        <QuickActionButtons 
          selectedContracts={mockSelectedContracts}
          selectedCount={3}
          onBulkStatusChange={onBulkStatusChange}
        />
      )
      
      await user.click(screen.getByTestId('bulk-actions-dropdown'))
      await user.click(screen.getByText('Change Status'))
      
      expect(onBulkStatusChange).toHaveBeenCalledWith(mockSelectedContracts)
    })

    it('should call onBulkExport when export is selected', async () => {
      const user = userEvent.setup()
      const onBulkExport = vi.fn()
      
      render(
        <QuickActionButtons 
          selectedContracts={mockSelectedContracts}
          selectedCount={3}
          onBulkExport={onBulkExport}
        />
      )
      
      await user.click(screen.getByTestId('bulk-actions-dropdown'))
      await user.click(screen.getByText('Export Selected'))
      
      expect(onBulkExport).toHaveBeenCalledWith(mockSelectedContracts)
    })

    it('should call onBulkDelete when delete is selected', async () => {
      const user = userEvent.setup()
      const onBulkDelete = vi.fn()
      
      render(
        <QuickActionButtons 
          selectedContracts={mockSelectedContracts}
          selectedCount={3}
          onBulkDelete={onBulkDelete}
        />
      )
      
      await user.click(screen.getByTestId('bulk-actions-dropdown'))
      await user.click(screen.getByText('Delete Selected'))
      
      expect(onBulkDelete).toHaveBeenCalledWith(mockSelectedContracts)
    })

    it('should call onBulkArchive when archive is selected', async () => {
      const user = userEvent.setup()
      const onBulkArchive = vi.fn()
      
      render(
        <QuickActionButtons 
          selectedContracts={mockSelectedContracts}
          selectedCount={3}
          onBulkArchive={onBulkArchive}
        />
      )
      
      await user.click(screen.getByTestId('bulk-actions-dropdown'))
      await user.click(screen.getByText('Archive Selected'))
      
      expect(onBulkArchive).toHaveBeenCalledWith(mockSelectedContracts)
    })

    it('should call onClearSelection when clear button is clicked', async () => {
      const user = userEvent.setup()
      const onClearSelection = vi.fn()
      
      render(
        <QuickActionButtons 
          selectedContracts={mockSelectedContracts}
          selectedCount={3}
          onClearSelection={onClearSelection}
        />
      )
      
      await user.click(screen.getByTestId('clear-selection-button'))
      expect(onClearSelection).toHaveBeenCalledTimes(1)
    })
  })

  describe('Loading states', () => {
    it('should show loading state for individual actions', () => {
      render(
        <QuickActionButtons 
          isLoading={{ newContract: true }}
        />
      )
      
      const button = screen.getByTestId('new-contract-button')
      expect(button).toBeDisabled()
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('should show loading state for bulk actions', () => {
      render(
        <QuickActionButtons 
          selectedContracts={mockSelectedContracts}
          selectedCount={3}
          isLoading={{ bulkActions: true }}
        />
      )
      
      const dropdown = screen.getByTestId('bulk-actions-dropdown')
      expect(dropdown).toBeDisabled()
      expect(screen.getByTestId('bulk-loading-spinner')).toBeInTheDocument()
    })

    it('should disable actions when loading', () => {
      render(
        <QuickActionButtons 
          isLoading={{ 
            newContract: true,
            uploadDocument: true,
            importTemplates: true,
            generateReport: true
          }}
        />
      )
      
      expect(screen.getByTestId('new-contract-button')).toBeDisabled()
      expect(screen.getByTestId('upload-document-button')).toBeDisabled()
      expect(screen.getByTestId('import-templates-button')).toBeDisabled()
      expect(screen.getByTestId('generate-report-button')).toBeDisabled()
    })
  })

  describe('Permission-based visibility', () => {
    it('should hide actions based on permissions', () => {
      render(
        <QuickActionButtons 
          permissions={{
            canCreateContract: false,
            canUploadDocument: false,
            canImportTemplates: true,
            canGenerateReport: true
          }}
        />
      )
      
      expect(screen.queryByText('New Contract')).not.toBeInTheDocument()
      expect(screen.queryByText('Upload Document')).not.toBeInTheDocument()
      expect(screen.getByText('Import Templates')).toBeInTheDocument()
      expect(screen.getByText('Generate Report')).toBeInTheDocument()
    })

    it('should hide bulk actions based on permissions', async () => {
      const user = userEvent.setup()
      render(
        <QuickActionButtons 
          selectedContracts={mockSelectedContracts}
          selectedCount={3}
          permissions={{
            canBulkDelete: false,
            canBulkArchive: false,
            canBulkExport: true,
            canBulkStatusChange: true
          }}
        />
      )
      
      await user.click(screen.getByTestId('bulk-actions-dropdown'))
      
      expect(screen.getByText('Change Status')).toBeInTheDocument()
      expect(screen.getByText('Export Selected')).toBeInTheDocument()
      expect(screen.queryByText('Delete Selected')).not.toBeInTheDocument()
      expect(screen.queryByText('Archive Selected')).not.toBeInTheDocument()
    })
  })

  describe('Custom styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <QuickActionButtons className="custom-actions" />
      )
      
      expect(container.firstChild).toHaveClass('custom-actions')
    })

    it('should use compact variant when specified', () => {
      render(<QuickActionButtons variant="compact" />)
      
      const container = screen.getByTestId('quick-actions-container')
      expect(container).toHaveClass('space-x-2') // More compact spacing
    })

    it('should use default variant by default', () => {
      render(<QuickActionButtons />)
      
      const container = screen.getByTestId('quick-actions-container')
      expect(container).toHaveClass('space-x-4') // Default spacing
    })
  })

  describe('Keyboard navigation', () => {
    it('should support keyboard navigation for buttons', () => {
      render(<QuickActionButtons />)
      
      const newContractButton = screen.getByTestId('new-contract-button')
      expect(newContractButton).toHaveAttribute('tabIndex', '0')
    })

    it('should support keyboard navigation for dropdown', () => {
      render(
        <QuickActionButtons 
          selectedContracts={mockSelectedContracts}
          selectedCount={3}
        />
      )
      
      const dropdown = screen.getByTestId('bulk-actions-dropdown')
      expect(dropdown).toHaveAttribute('tabIndex', '0')
    })

    it('should handle Enter key for button activation', async () => {
      const user = userEvent.setup()
      const onNewContract = vi.fn()
      
      render(<QuickActionButtons onNewContract={onNewContract} />)
      
      const button = screen.getByTestId('new-contract-button')
      button.focus()
      await user.keyboard('{Enter}')
      
      expect(onNewContract).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<QuickActionButtons />)
      
      const container = screen.getByTestId('quick-actions-container')
      expect(container).toHaveAttribute('aria-label', 'Quick contract actions')
    })

    it('should have proper ARIA labels for buttons', () => {
      render(<QuickActionButtons />)
      
      expect(screen.getByTestId('new-contract-button')).toHaveAttribute('aria-label', 'Create new contract')
      expect(screen.getByTestId('upload-document-button')).toHaveAttribute('aria-label', 'Upload document')
    })

    it('should have proper ARIA labels for bulk actions', () => {
      render(
        <QuickActionButtons 
          selectedContracts={mockSelectedContracts}
          selectedCount={3}
        />
      )
      
      expect(screen.getByTestId('bulk-actions-dropdown')).toHaveAttribute('aria-label', 'Bulk actions for 3 selected contracts')
    })

    it('should announce selection count to screen readers', () => {
      render(
        <QuickActionButtons 
          selectedContracts={mockSelectedContracts}
          selectedCount={3}
        />
      )
      
      const selectionInfo = screen.getByTestId('selection-info')
      expect(selectionInfo).toHaveAttribute('aria-live', 'polite')
      expect(selectionInfo).toHaveTextContent('3 contracts selected')
    })
  })

  describe('Error handling', () => {
    it('should display error message when action fails', () => {
      render(
        <QuickActionButtons 
          error="Failed to create contract. Please try again."
        />
      )
      
      expect(screen.getByText('Failed to create contract. Please try again.')).toBeInTheDocument()
      expect(screen.getByTestId('error-icon')).toBeInTheDocument()
    })

    it('should clear error when retry is clicked', async () => {
      const user = userEvent.setup()
      const onRetry = vi.fn()
      
      render(
        <QuickActionButtons 
          error="Failed to create contract."
          onRetry={onRetry}
        />
      )
      
      await user.click(screen.getByText('Retry'))
      expect(onRetry).toHaveBeenCalledTimes(1)
    })
  })

  describe('Responsive behavior', () => {
    it('should show mobile menu on small screens', () => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      })
      
      render(<QuickActionButtons showMobileMenu={true} />)
      
      expect(screen.getByTestId('mobile-menu-button')).toBeInTheDocument()
      expect(screen.getByLabelText('More actions')).toBeInTheDocument()
    })

    it('should hide secondary actions on mobile when collapsed', () => {
      render(<QuickActionButtons showMobileMenu={true} />)
      
      expect(screen.getByText('New Contract')).toBeInTheDocument()
      expect(screen.queryByText('Import Templates')).not.toBeInTheDocument()
    })
  })
})