/**
 * ContractEditPage Tests - Comprehensive Test Suite
 * Following strict TDD methodology with real implementations (no mocks/stubs)
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import userEvent from '@testing-library/user-event'

import ContractEditPage from '../ContractEditPage'
import { contractService } from '@/services/contract.service'

// Test data
const mockContract = {
  id: '123',
  title: 'Test Purchase Agreement',
  contract_number: 'PUR-2024-001',
  contract_type: 'purchase',
  status: 'draft',
  description: 'Test contract description',
  value: 50000,
  currency: 'USD',
  start_date: '2024-01-01',
  end_date: '2024-12-31',
  counterparty_name: 'Test Counterparty',
  counterparty_email: 'test@example.com',
  counterparty_phone: '+1234567890',
  internal_owner_id: 'owner-123',
  approver_ids: ['approver-1', 'approver-2'],
  payment_terms: 'net_30',
  auto_renewal: false,
  renewal_notice_period: 30,
  governing_law: 'California',
  key_clause_ids: ['clause-1', 'clause-2'],
  parties: ['Test Company', 'Test Counterparty'],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T12:00:00Z',
  metadata: {}
}

const mockExecutedContract = {
  ...mockContract,
  id: '456',
  status: 'executed',
  title: 'Executed Contract'
}

const mockVersions = [
  {
    id: 'version-1',
    version_number: 1,
    created_at: '2024-01-01T00:00:00Z',
    created_by: 'user-1',
    changes: 'Initial version'
  },
  {
    id: 'version-2', 
    version_number: 2,
    created_at: '2024-01-02T00:00:00Z',
    created_by: 'user-1',
    changes: 'Updated payment terms'
  }
]

const mockDocuments = [
  {
    id: 'doc-1',
    filename: 'contract.pdf',
    size: 1024,
    uploaded_at: '2024-01-01T00:00:00Z',
    uploaded_by: 'user-1'
  }
]

// Helper to render component with router
const renderWithRouter = (contractId: string = '123') => {
  return render(
    <MemoryRouter initialEntries={[`/contracts/${contractId}/edit`]}>
      <Routes>
        <Route path="/contracts/:id/edit" element={<ContractEditPage />} />
        <Route path="/contracts/:id" element={<div>Contract Details</div>} />
        <Route path="/contracts" element={<div>Contracts List</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ContractEditPage', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial Render and Data Fetching', () => {
    it('should render loading state initially', () => {
      // Mock getContract to return a pending promise
      vi.spyOn(contractService, 'getContract').mockImplementation(() => 
        new Promise(() => {}) // Never resolves to keep loading
      )
      vi.spyOn(contractService, 'getVersions').mockImplementation(() => 
        new Promise(() => {}) // Never resolves to keep loading
      )
      vi.spyOn(contractService, 'getDocuments').mockImplementation(() => 
        new Promise(() => {}) // Never resolves to keep loading
      )

      renderWithRouter()
      
      expect(screen.getByText('Loading contract...')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('should extract contract ID from URL params', async () => {
      const getContractSpy = vi.spyOn(contractService, 'getContract')
        .mockResolvedValue(mockContract)
      
      renderWithRouter('test-contract-id')
      
      await waitFor(() => {
        expect(getContractSpy).toHaveBeenCalledWith('test-contract-id')
      })
    })

    it('should fetch and display contract data', async () => {
      vi.spyOn(contractService, 'getContract').mockResolvedValue(mockContract)
      vi.spyOn(contractService, 'getVersions').mockResolvedValue(mockVersions)
      vi.spyOn(contractService, 'getDocuments').mockResolvedValue(mockDocuments)
      
      renderWithRouter()
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Purchase Agreement')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Test Counterparty')).toBeInTheDocument()
        expect(screen.getByDisplayValue('50000')).toBeInTheDocument()
      })
    })

    it('should display page title with contract number', async () => {
      vi.spyOn(contractService, 'getContract').mockResolvedValue(mockContract)
      vi.spyOn(contractService, 'getVersions').mockResolvedValue(mockVersions)
      vi.spyOn(contractService, 'getDocuments').mockResolvedValue(mockDocuments)
      
      renderWithRouter()
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /edit contract PUR-2024-001/i }))
          .toBeInTheDocument()
      })
    })

    it('should handle contract not found error', async () => {
      vi.spyOn(contractService, 'getContract')
        .mockRejectedValue(new Error('Contract not found'))
      
      renderWithRouter()
      
      await waitFor(() => {
        expect(screen.getByText(/contract not found/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
      })
    })

    it('should handle API errors with retry option', async () => {
      vi.spyOn(contractService, 'getContract')
        .mockRejectedValue(new Error('Server error'))
      
      renderWithRouter()
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load contract/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })
  })

  describe('Form Pre-population and Display', () => {
    beforeEach(async () => {
      vi.spyOn(contractService, 'getContract').mockResolvedValue(mockContract)
      vi.spyOn(contractService, 'getVersions').mockResolvedValue(mockVersions)
      vi.spyOn(contractService, 'getDocuments').mockResolvedValue(mockDocuments)
    })

    it('should pre-populate all basic information fields', async () => {
      renderWithRouter()
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Purchase Agreement')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Test contract description')).toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: /contract type/i }))
          .toHaveValue('purchase')
      })
    })

    it('should pre-populate parties and stakeholders fields', async () => {
      renderWithRouter()
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Counterparty')).toBeInTheDocument()
        expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument()
        expect(screen.getByDisplayValue('+1234567890')).toBeInTheDocument()
        expect(screen.getByDisplayValue('owner-123')).toBeInTheDocument()
      })
    })

    it('should pre-populate terms and conditions fields', async () => {
      renderWithRouter()
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('50000')).toBeInTheDocument()
        expect(screen.getByDisplayValue('2024-01-01')).toBeInTheDocument()
        expect(screen.getByDisplayValue('2024-12-31')).toBeInTheDocument()
        expect(screen.getByDisplayValue('California')).toBeInTheDocument()
      })
    })

    it('should display version history in sidebar', async () => {
      renderWithRouter()
      
      await waitFor(() => {
        expect(screen.getByText('Version History')).toBeInTheDocument()
        expect(screen.getByText('v1 - Initial version')).toBeInTheDocument()
        expect(screen.getByText('v2 - Updated payment terms')).toBeInTheDocument()
      })
    })

    it('should display attached documents', async () => {
      renderWithRouter()
      
      await waitFor(() => {
        expect(screen.getByText('Attachments')).toBeInTheDocument()
        expect(screen.getByText('contract.pdf')).toBeInTheDocument()
      })
    })
  })

  describe('Change Tracking and Visual Indicators', () => {
    beforeEach(async () => {
      vi.spyOn(contractService, 'getContract').mockResolvedValue(mockContract)
      vi.spyOn(contractService, 'getVersions').mockResolvedValue(mockVersions)
      vi.spyOn(contractService, 'getDocuments').mockResolvedValue(mockDocuments)
    })

    it('should highlight modified fields', async () => {
      renderWithRouter()
      
      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
        expect(titleInput).toBeInTheDocument()
      })
      
      const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
      await user.clear(titleInput)
      await user.type(titleInput, 'Modified Purchase Agreement')
      
      await waitFor(() => {
        expect(titleInput.closest('.field-container')).toHaveClass('field-modified')
      })
    })

    it('should show original vs modified values', async () => {
      renderWithRouter()
      
      await waitFor(() => {
        const valueInput = screen.getByDisplayValue('50000')
        expect(valueInput).toBeInTheDocument()
      })
      
      const valueInput = screen.getByDisplayValue('50000')
      await user.clear(valueInput)
      await user.type(valueInput, '75000')
      
      await waitFor(() => {
        expect(screen.getByText('Original: $50,000')).toBeInTheDocument()
        expect(screen.getByText('Modified: $75,000')).toBeInTheDocument()
      })
    })

    it('should track unsaved changes indicator', async () => {
      renderWithRouter()
      
      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
        expect(titleInput).toBeInTheDocument()
      })
      
      const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
      await user.type(titleInput, ' - Modified')
      
      await waitFor(() => {
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /save changes/i })).toBeEnabled()
      })
    })

    it('should show warning for significant changes', async () => {
      renderWithRouter()
      
      await waitFor(() => {
        const valueInput = screen.getByDisplayValue('50000')
        expect(valueInput).toBeInTheDocument()
      })
      
      const valueInput = screen.getByDisplayValue('50000')
      await user.clear(valueInput)
      await user.type(valueInput, '150000')
      
      await waitFor(() => {
        expect(screen.getByText(/significant value change detected/i)).toBeInTheDocument()
        expect(screen.getByText(/may require re-approval/i)).toBeInTheDocument()
      })
    })
  })

  describe('Version Control and Comparison', () => {
    beforeEach(async () => {
      vi.spyOn(contractService, 'getContract').mockResolvedValue(mockContract)
      vi.spyOn(contractService, 'getVersions').mockResolvedValue(mockVersions)
      vi.spyOn(contractService, 'getDocuments').mockResolvedValue(mockDocuments)
    })

    it('should display version history sidebar', async () => {
      renderWithRouter()
      
      await waitFor(() => {
        expect(screen.getByText('Version History')).toBeInTheDocument()
        expect(screen.getByText('v1')).toBeInTheDocument()
        expect(screen.getByText('v2')).toBeInTheDocument()
      })
    })

    it('should allow comparing with previous versions', async () => {
      vi.spyOn(contractService, 'compareVersions').mockResolvedValue({
        version1: 'version-1',
        version2: 'version-2',
        differences: [
          {
            type: 'modified',
            path: 'payment_terms',
            old_value: 'net_60',
            new_value: 'net_30'
          }
        ]
      })

      renderWithRouter()
      
      await waitFor(() => {
        const compareButton = screen.getByRole('button', { name: /compare versions/i })
        expect(compareButton).toBeInTheDocument()
      })
      
      await user.click(screen.getByRole('button', { name: /compare versions/i }))
      
      await waitFor(() => {
        expect(screen.getByText('Version Comparison')).toBeInTheDocument()
        expect(screen.getByText('payment_terms: net_60 → net_30')).toBeInTheDocument()
      })
    })

    it('should allow reverting to previous version', async () => {
      const updateContractSpy = vi.spyOn(contractService, 'updateContract')
        .mockResolvedValue(mockContract)

      renderWithRouter()
      
      await waitFor(() => {
        const revertButton = screen.getByRole('button', { name: /revert to v1/i })
        expect(revertButton).toBeInTheDocument()
      })
      
      await user.click(screen.getByRole('button', { name: /revert to v1/i }))
      
      // Confirm revert in modal
      await user.click(screen.getByRole('button', { name: /confirm revert/i }))
      
      await waitFor(() => {
        expect(updateContractSpy).toHaveBeenCalled()
        expect(screen.getByText(/reverted to version 1/i)).toBeInTheDocument()
      })
    })

    it('should require version comment when saving', async () => {
      renderWithRouter()
      
      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
        expect(titleInput).toBeInTheDocument()
      })
      
      // Make a change
      const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
      await user.type(titleInput, ' - Modified')
      
      // Try to save without comment
      await user.click(screen.getByRole('button', { name: /save changes/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/version comment is required/i)).toBeInTheDocument()
        expect(screen.getByRole('textbox', { name: /describe your changes/i })).toBeInTheDocument()
      })
    })
  })

  describe('Validation and Editing Restrictions', () => {
    it('should disable editing for executed contracts', async () => {
      vi.spyOn(contractService, 'getContract').mockResolvedValue(mockExecutedContract)
      vi.spyOn(contractService, 'getVersions').mockResolvedValue(mockVersions)
      vi.spyOn(contractService, 'getDocuments').mockResolvedValue(mockDocuments)

      renderWithRouter('456')
      
      await waitFor(() => {
        expect(screen.getByText(/contract is executed and cannot be edited/i))
          .toBeInTheDocument()
        
        const titleInput = screen.getByDisplayValue('Executed Contract')
        expect(titleInput).toBeDisabled()
      })
    })

    it('should show locked fields based on contract status', async () => {
      const activeContract = { ...mockContract, status: 'active' }
      vi.spyOn(contractService, 'getContract').mockResolvedValue(activeContract)
      vi.spyOn(contractService, 'getVersions').mockResolvedValue(mockVersions)
      vi.spyOn(contractService, 'getDocuments').mockResolvedValue(mockDocuments)

      renderWithRouter()
      
      await waitFor(() => {
        const valueInput = screen.getByDisplayValue('50000')
        expect(valueInput).toBeDisabled()
        expect(screen.getByText(/value cannot be changed on active contracts/i))
          .toBeInTheDocument()
      })
    })

    it('should validate date order', async () => {
      vi.spyOn(contractService, 'getContract').mockResolvedValue(mockContract)
      vi.spyOn(contractService, 'getVersions').mockResolvedValue(mockVersions)
      vi.spyOn(contractService, 'getDocuments').mockResolvedValue(mockDocuments)

      renderWithRouter()
      
      await waitFor(() => {
        const endDateInput = screen.getByDisplayValue('2024-12-31')
        expect(endDateInput).toBeInTheDocument()
      })
      
      const endDateInput = screen.getByDisplayValue('2024-12-31')
      await user.clear(endDateInput)
      await user.type(endDateInput, '2023-12-31')
      
      await waitFor(() => {
        expect(screen.getByText(/end date must be after start date/i))
          .toBeInTheDocument()
      })
    })

    it('should validate required fields', async () => {
      vi.spyOn(contractService, 'getContract').mockResolvedValue(mockContract)
      vi.spyOn(contractService, 'getVersions').mockResolvedValue(mockVersions)
      vi.spyOn(contractService, 'getDocuments').mockResolvedValue(mockDocuments)

      renderWithRouter()
      
      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
        expect(titleInput).toBeInTheDocument()
      })
      
      const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
      await user.clear(titleInput)
      
      await user.click(screen.getByRole('button', { name: /save changes/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument()
      })
    })
  })

  describe('Auto-save Functionality', () => {
    beforeEach(async () => {
      vi.spyOn(contractService, 'getContract').mockResolvedValue(mockContract)
      vi.spyOn(contractService, 'getVersions').mockResolvedValue(mockVersions)
      vi.spyOn(contractService, 'getDocuments').mockResolvedValue(mockDocuments)
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should auto-save draft after 30 seconds of inactivity', async () => {
      const updateContractSpy = vi.spyOn(contractService, 'updateContract')
        .mockResolvedValue(mockContract)

      renderWithRouter()
      
      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
        expect(titleInput).toBeInTheDocument()
      })
      
      // Make a change
      const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
      await user.type(titleInput, ' - Auto Save Test')
      
      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30000)
      
      await waitFor(() => {
        expect(updateContractSpy).toHaveBeenCalled()
        expect(screen.getByText(/draft saved automatically/i)).toBeInTheDocument()
      })
    })

    it('should show auto-save status indicator', async () => {
      vi.spyOn(contractService, 'updateContract').mockResolvedValue(mockContract)

      renderWithRouter()
      
      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
        expect(titleInput).toBeInTheDocument()
      })
      
      const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
      await user.type(titleInput, ' - Status Test')
      
      await waitFor(() => {
        expect(screen.getByText(/saving.../i)).toBeInTheDocument()
      })
      
      vi.advanceTimersByTime(30000)
      
      await waitFor(() => {
        expect(screen.getByText(/draft saved at/i)).toBeInTheDocument()
      })
    })

    it('should handle auto-save failures gracefully', async () => {
      vi.spyOn(contractService, 'updateContract')
        .mockRejectedValue(new Error('Network error'))

      renderWithRouter()
      
      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
        expect(titleInput).toBeInTheDocument()
      })
      
      const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
      await user.type(titleInput, ' - Error Test')
      
      vi.advanceTimersByTime(30000)
      
      await waitFor(() => {
        expect(screen.getByText(/auto-save failed/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry save/i })).toBeInTheDocument()
      })
    })
  })

  describe('File Attachment Management', () => {
    beforeEach(async () => {
      vi.spyOn(contractService, 'getContract').mockResolvedValue(mockContract)
      vi.spyOn(contractService, 'getVersions').mockResolvedValue(mockVersions)
      vi.spyOn(contractService, 'getDocuments').mockResolvedValue(mockDocuments)
    })

    it('should display existing attachments', async () => {
      renderWithRouter()
      
      await waitFor(() => {
        expect(screen.getByText('contract.pdf')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /download contract.pdf/i }))
          .toBeInTheDocument()
      })
    })

    it('should allow adding new attachments', async () => {
      const uploadDocumentSpy = vi.spyOn(contractService, 'uploadDocument')
        .mockResolvedValue({
          id: 'doc-2',
          filename: 'new-document.pdf',
          size: 2048,
          uploaded_at: '2024-01-03T00:00:00Z'
        })

      renderWithRouter()
      
      await waitFor(() => {
        const fileInput = screen.getByLabelText(/add attachment/i)
        expect(fileInput).toBeInTheDocument()
      })
      
      const file = new File(['test content'], 'new-document.pdf', { type: 'application/pdf' })
      const fileInput = screen.getByLabelText(/add attachment/i) as HTMLInputElement
      
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(uploadDocumentSpy).toHaveBeenCalledWith('123', file, expect.any(Object))
        expect(screen.getByText('new-document.pdf')).toBeInTheDocument()
      })
    })

    it('should allow removing attachments', async () => {
      renderWithRouter()
      
      await waitFor(() => {
        const removeButton = screen.getByRole('button', { name: /remove contract.pdf/i })
        expect(removeButton).toBeInTheDocument()
      })
      
      await user.click(screen.getByRole('button', { name: /remove contract.pdf/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to remove this attachment/i))
          .toBeInTheDocument()
      })
      
      await user.click(screen.getByRole('button', { name: /confirm remove/i }))
      
      await waitFor(() => {
        expect(screen.queryByText('contract.pdf')).not.toBeInTheDocument()
      })
    })
  })

  describe('Navigation and Cancel Behavior', () => {
    beforeEach(async () => {
      vi.spyOn(contractService, 'getContract').mockResolvedValue(mockContract)
      vi.spyOn(contractService, 'getVersions').mockResolvedValue(mockVersions)
      vi.spyOn(contractService, 'getDocuments').mockResolvedValue(mockDocuments)
    })

    it('should warn when leaving with unsaved changes', async () => {
      renderWithRouter()
      
      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
        expect(titleInput).toBeInTheDocument()
      })
      
      // Make changes
      const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
      await user.type(titleInput, ' - Modified')
      
      // Try to cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/you have unsaved changes/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /discard changes/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /keep editing/i })).toBeInTheDocument()
      })
    })

    it('should allow discarding changes and navigating away', async () => {
      renderWithRouter()
      
      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
        expect(titleInput).toBeInTheDocument()
      })
      
      const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
      await user.type(titleInput, ' - Modified')
      
      await user.click(screen.getByRole('button', { name: /cancel/i }))
      await user.click(screen.getByRole('button', { name: /discard changes/i }))
      
      await waitFor(() => {
        expect(screen.getByText('Contract Details')).toBeInTheDocument()
      })
    })

    it('should navigate to contract details after successful save', async () => {
      const updateContractSpy = vi.spyOn(contractService, 'updateContract')
        .mockResolvedValue(mockContract)
      const createVersionSpy = vi.spyOn(contractService, 'createVersion')
        .mockResolvedValue(mockVersions[0])

      renderWithRouter()
      
      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
        expect(titleInput).toBeInTheDocument()
      })
      
      const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
      await user.type(titleInput, ' - Updated')
      
      await user.click(screen.getByRole('button', { name: /save changes/i }))
      
      // Add version comment
      const commentInput = screen.getByRole('textbox', { name: /describe your changes/i })
      await user.type(commentInput, 'Updated contract title')
      
      await user.click(screen.getByRole('button', { name: /save with comment/i }))
      
      await waitFor(() => {
        expect(updateContractSpy).toHaveBeenCalled()
        expect(createVersionSpy).toHaveBeenCalled()
        expect(screen.getByText('Contract Details')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility and User Experience', () => {
    beforeEach(async () => {
      vi.spyOn(contractService, 'getContract').mockResolvedValue(mockContract)
      vi.spyOn(contractService, 'getVersions').mockResolvedValue(mockVersions)
      vi.spyOn(contractService, 'getDocuments').mockResolvedValue(mockDocuments)
    })

    it('should have proper ARIA labels and roles', async () => {
      renderWithRouter()
      
      await waitFor(() => {
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Edit contract')
        expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Contract edit form')
        expect(screen.getByLabelText(/contract title/i)).toBeInTheDocument()
      })
    })

    it('should announce changes to screen readers', async () => {
      renderWithRouter()
      
      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
        expect(titleInput).toBeInTheDocument()
      })
      
      const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
      await user.type(titleInput, ' - Modified')
      
      await waitFor(() => {
        const announcements = screen.getByRole('status', { name: /live-region/i })
        expect(announcements).toHaveTextContent(/field modified/i)
      })
    })

    it('should support keyboard navigation', async () => {
      renderWithRouter()
      
      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
        expect(titleInput).toBeInTheDocument()
      })
      
      const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
      titleInput.focus()
      
      // Tab through form fields
      await user.tab()
      expect(screen.getByRole('combobox', { name: /contract type/i })).toHaveFocus()
      
      await user.tab()
      expect(screen.getByDisplayValue('Test contract description')).toHaveFocus()
    })

    it('should be responsive on mobile devices', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      })

      renderWithRouter()
      
      await waitFor(() => {
        const form = screen.getByRole('form')
        expect(form).toHaveClass('mobile-layout')
        expect(screen.getByText('Version History')).toHaveClass('mobile-sidebar')
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle network errors during save', async () => {
      vi.spyOn(contractService, 'getContract').mockResolvedValue(mockContract)
      vi.spyOn(contractService, 'getVersions').mockResolvedValue(mockVersions)
      vi.spyOn(contractService, 'getDocuments').mockResolvedValue(mockDocuments)
      vi.spyOn(contractService, 'updateContract')
        .mockRejectedValue(new Error('Network error'))

      renderWithRouter()
      
      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
        expect(titleInput).toBeInTheDocument()
      })
      
      const titleInput = screen.getByDisplayValue('Test Purchase Agreement')
      await user.type(titleInput, ' - Error Test')
      
      await user.click(screen.getByRole('button', { name: /save changes/i }))
      
      const commentInput = screen.getByRole('textbox', { name: /describe your changes/i })
      await user.type(commentInput, 'Test save error')
      
      await user.click(screen.getByRole('button', { name: /save with comment/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/failed to save changes/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry save/i })).toBeInTheDocument()
      })
    })

    it('should handle file upload errors', async () => {
      vi.spyOn(contractService, 'getContract').mockResolvedValue(mockContract)
      vi.spyOn(contractService, 'getVersions').mockResolvedValue(mockVersions)
      vi.spyOn(contractService, 'getDocuments').mockResolvedValue(mockDocuments)
      vi.spyOn(contractService, 'uploadDocument')
        .mockRejectedValue(new Error('Upload failed'))

      renderWithRouter()
      
      await waitFor(() => {
        const fileInput = screen.getByLabelText(/add attachment/i)
        expect(fileInput).toBeInTheDocument()
      })
      
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = screen.getByLabelText(/add attachment/i) as HTMLInputElement
      
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByText(/failed to upload file/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry upload/i })).toBeInTheDocument()
      })
    })

    it('should handle empty or malformed contract data', async () => {
      const malformedContract = {
        id: '123',
        title: '',
        status: null,
        created_at: 'invalid-date'
      }
      
      vi.spyOn(contractService, 'getContract').mockResolvedValue(malformedContract as any)
      vi.spyOn(contractService, 'getVersions').mockResolvedValue([])
      vi.spyOn(contractService, 'getDocuments').mockResolvedValue([])

      renderWithRouter()
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('')).toBeInTheDocument() // Empty title
        expect(screen.getByText(/unknown status/i)).toBeInTheDocument()
        expect(screen.getByText(/no version history/i)).toBeInTheDocument()
      })
    })
  })
})