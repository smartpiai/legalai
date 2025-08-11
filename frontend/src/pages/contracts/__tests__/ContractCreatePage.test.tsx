/**
 * ContractCreatePage Tests - TDD Implementation
 * Comprehensive test coverage for multi-step contract creation wizard
 */
import React from 'react'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createMockContract, mockApiResponse, mockApiError } from '@/test/utils'
import { contractService } from '@/services/contract.service'
import ContractCreatePage from '../ContractCreatePage'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock the contract service
vi.mock('@/services/contract.service', () => ({
  contractService: {
    createContract: vi.fn(),
    createFromTemplate: vi.fn(),
    getTemplates: vi.fn(),
    suggestClauses: vi.fn(),
    getRiskAssessment: vi.fn(),
    uploadDocument: vi.fn(),
  }
}))

// Mock React Router navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock file upload
global.File = class MockFile {
  name: string
  size: number
  type: string

  constructor(bits: BlobPart[], filename: string, options: FilePropertyBag = {}) {
    this.name = filename
    this.size = bits.reduce((acc, bit) => acc + (bit as any).length, 0)
    this.type = options.type || ''
  }
} as any

describe('ContractCreatePage', () => {
  const user = userEvent.setup()
  
  beforeEach(() => {
    vi.clearAllMocks()
    // Setup default mock responses
    vi.mocked(contractService.getTemplates).mockResolvedValue([
      { id: '1', name: 'Purchase Agreement', category: 'purchase' },
      { id: '2', name: 'NDA Template', category: 'nda' },
    ])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial Render', () => {
    it('renders the contract creation wizard', async () => {
      render(<ContractCreatePage />)
      
      expect(screen.getByText('Create New Contract')).toBeInTheDocument()
      expect(screen.getByText('Step 1 of 4: Basic Information')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('shows progress indicator with correct step', async () => {
      render(<ContractCreatePage />)
      
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '1')
      expect(progressBar).toHaveAttribute('aria-valuemax', '4')
    })

    it('displays template selection option', async () => {
      render(<ContractCreatePage />)
      
      expect(screen.getByText('Start from template')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /choose template/i })).toBeInTheDocument()
    })

    it('shows cancel button', async () => {
      render(<ContractCreatePage />)
      
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  describe('Step 1: Basic Information', () => {
    it('renders all basic information fields', async () => {
      render(<ContractCreatePage />)
      
      expect(screen.getByLabelText(/contract title/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/contract type/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    })

    it('validates required fields', async () => {
      render(<ContractCreatePage />)
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument()
        expect(screen.getByText('Contract type is required')).toBeInTheDocument()
      })
    })

    it('validates minimum title length', async () => {
      render(<ContractCreatePage />)
      
      const titleInput = screen.getByLabelText(/contract title/i)
      await user.type(titleInput, 'Test')
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        expect(screen.getByText('Title must be at least 5 characters')).toBeInTheDocument()
      })
    })

    it('validates description maximum length', async () => {
      render(<ContractCreatePage />)
      
      const descriptionInput = screen.getByLabelText(/description/i)
      const longText = 'A'.repeat(501)
      await user.type(descriptionInput, longText)
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        expect(screen.getByText('Description must not exceed 500 characters')).toBeInTheDocument()
      })
    })

    it('advances to step 2 with valid data', async () => {
      render(<ContractCreatePage />)
      
      await user.type(screen.getByLabelText(/contract title/i), 'Test Contract Title')
      await user.selectOptions(screen.getByLabelText(/contract type/i), 'purchase')
      await user.type(screen.getByLabelText(/description/i), 'Test description')
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        expect(screen.getByText('Step 2 of 4: Parties & Stakeholders')).toBeInTheDocument()
      })
    })

    it('suggests contract type based on AI', async () => {
      vi.mocked(contractService.suggestClauses).mockResolvedValue({
        suggested_type: 'purchase',
        confidence: 0.85
      })
      
      render(<ContractCreatePage />)
      
      await user.type(screen.getByLabelText(/contract title/i), 'Software Purchase Agreement')
      
      await waitFor(() => {
        expect(screen.getByText('AI suggests: Purchase Agreement')).toBeInTheDocument()
      })
    })
  })

  describe('Step 2: Parties & Stakeholders', () => {
    beforeEach(async () => {
      render(<ContractCreatePage />)
      
      // Fill step 1
      await user.type(screen.getByLabelText(/contract title/i), 'Test Contract')
      await user.selectOptions(screen.getByLabelText(/contract type/i), 'purchase')
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => {
        expect(screen.getByText('Step 2 of 4: Parties & Stakeholders')).toBeInTheDocument()
      })
    })

    it('renders parties and stakeholders fields', async () => {
      expect(screen.getByLabelText(/counterparty name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/counterparty email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/counterparty phone/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/internal owner/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/approvers/i)).toBeInTheDocument()
    })

    it('validates required counterparty information', async () => {
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        expect(screen.getByText('Counterparty name is required')).toBeInTheDocument()
      })
    })

    it('validates email format', async () => {
      await user.type(screen.getByLabelText(/counterparty email/i), 'invalid-email')
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        expect(screen.getByText('Invalid email format')).toBeInTheDocument()
      })
    })

    it('validates at least one approver is required', async () => {
      await user.type(screen.getByLabelText(/counterparty name/i), 'ACME Corp')
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        expect(screen.getByText('At least one approver is required')).toBeInTheDocument()
      })
    })

    it('allows going back to step 1', async () => {
      const backButton = screen.getByRole('button', { name: /back/i })
      await user.click(backButton)
      
      await waitFor(() => {
        expect(screen.getByText('Step 1 of 4: Basic Information')).toBeInTheDocument()
      })
    })
  })

  describe('Step 3: Terms & Conditions', () => {
    beforeEach(async () => {
      render(<ContractCreatePage />)
      
      // Navigate to step 3
      await user.type(screen.getByLabelText(/contract title/i), 'Test Contract')
      await user.selectOptions(screen.getByLabelText(/contract type/i), 'purchase')
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => {
        expect(screen.getByText('Step 2 of 4: Parties & Stakeholders')).toBeInTheDocument()
      })
      
      await user.type(screen.getByLabelText(/counterparty name/i), 'ACME Corp')
      // Mock approver selection
      await user.click(screen.getByLabelText(/approvers/i))
      await user.click(screen.getByRole('option', { name: /john doe/i }))
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => {
        expect(screen.getByText('Step 3 of 4: Terms & Conditions')).toBeInTheDocument()
      })
    })

    it('renders terms and conditions fields', async () => {
      expect(screen.getByLabelText(/contract value/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/end date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/payment terms/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/governing law/i)).toBeInTheDocument()
    })

    it('validates positive contract value', async () => {
      await user.type(screen.getByLabelText(/contract value/i), '-1000')
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        expect(screen.getByText('Contract value must be positive')).toBeInTheDocument()
      })
    })

    it('validates end date is after start date', async () => {
      await user.type(screen.getByLabelText(/start date/i), '2024-12-31')
      await user.type(screen.getByLabelText(/end date/i), '2024-01-01')
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        expect(screen.getByText('End date must be after start date')).toBeInTheDocument()
      })
    })

    it('suggests clauses based on contract type', async () => {
      vi.mocked(contractService.suggestClauses).mockResolvedValue({
        clauses: [
          { id: '1', title: 'Payment Terms', recommended: true },
          { id: '2', title: 'Termination Clause', recommended: true }
        ]
      })
      
      await waitFor(() => {
        expect(screen.getByText('Recommended Clauses')).toBeInTheDocument()
        expect(screen.getByText('Payment Terms')).toBeInTheDocument()
        expect(screen.getByText('Termination Clause')).toBeInTheDocument()
      })
    })
  })

  describe('Step 4: Review & Submit', () => {
    beforeEach(async () => {
      render(<ContractCreatePage />)
      
      // Navigate through all steps
      await user.type(screen.getByLabelText(/contract title/i), 'Test Contract')
      await user.selectOptions(screen.getByLabelText(/contract type/i), 'purchase')
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await user.type(screen.getByLabelText(/counterparty name/i), 'ACME Corp')
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await user.type(screen.getByLabelText(/contract value/i), '10000')
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => {
        expect(screen.getByText('Step 4 of 4: Review & Submit')).toBeInTheDocument()
      })
    })

    it('displays contract summary', async () => {
      expect(screen.getByText('Contract Summary')).toBeInTheDocument()
      expect(screen.getByText('Test Contract')).toBeInTheDocument()
      expect(screen.getByText('ACME Corp')).toBeInTheDocument()
      expect(screen.getByText('$10,000')).toBeInTheDocument()
    })

    it('shows submit and save as draft buttons', async () => {
      expect(screen.getByRole('button', { name: /create contract/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save as draft/i })).toBeInTheDocument()
    })

    it('successfully creates contract', async () => {
      const mockContract = createMockContract({ id: '123', title: 'Test Contract' })
      vi.mocked(contractService.createContract).mockResolvedValue(mockContract)
      
      const submitButton = screen.getByRole('button', { name: /create contract/i })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(contractService.createContract).toHaveBeenCalledWith(expect.objectContaining({
          title: 'Test Contract',
          contract_type: 'purchase',
          counterparty_name: 'ACME Corp',
          value: 10000
        }))
      })
      
      expect(mockNavigate).toHaveBeenCalledWith('/contracts/123')
    })

    it('saves contract as draft', async () => {
      const mockContract = createMockContract({ id: '123', status: 'draft' })
      vi.mocked(contractService.createContract).mockResolvedValue(mockContract)
      
      const draftButton = screen.getByRole('button', { name: /save as draft/i })
      await user.click(draftButton)
      
      await waitFor(() => {
        expect(contractService.createContract).toHaveBeenCalledWith(expect.objectContaining({
          status: 'draft'
        }))
      })
    })

    it('handles creation errors', async () => {
      vi.mocked(contractService.createContract).mockRejectedValue(
        new Error('Validation failed')
      )
      
      const submitButton = screen.getByRole('button', { name: /create contract/i })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Failed to create contract: Validation failed')).toBeInTheDocument()
      })
    })
  })

  describe('Template Selection', () => {
    it('shows template selection modal', async () => {
      render(<ContractCreatePage />)
      
      const templateButton = screen.getByRole('button', { name: /choose template/i })
      await user.click(templateButton)
      
      await waitFor(() => {
        expect(screen.getByText('Select Template')).toBeInTheDocument()
        expect(screen.getByText('Purchase Agreement')).toBeInTheDocument()
        expect(screen.getByText('NDA Template')).toBeInTheDocument()
      })
    })

    it('populates form with template data', async () => {
      vi.mocked(contractService.createFromTemplate).mockResolvedValue({
        id: 'temp-123',
        title: 'Template Contract',
        contract_type: 'nda',
        description: 'Template description'
      })
      
      render(<ContractCreatePage />)
      
      await user.click(screen.getByRole('button', { name: /choose template/i }))
      await user.click(screen.getByText('NDA Template'))
      await user.click(screen.getByRole('button', { name: /use template/i }))
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Template Contract')).toBeInTheDocument()
        expect(screen.getByDisplayValue('nda')).toBeInTheDocument()
      })
    })
  })

  describe('File Upload', () => {
    it('renders file upload area', async () => {
      render(<ContractCreatePage />)
      
      expect(screen.getByText(/drag.*drop.*files/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /browse files/i })).toBeInTheDocument()
    })

    it('validates file size limits', async () => {
      render(<ContractCreatePage />)
      
      const file = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf', {
        type: 'application/pdf'
      })
      
      const input = screen.getByLabelText(/file upload/i)
      await user.upload(input, file)
      
      await waitFor(() => {
        expect(screen.getByText('File size must not exceed 10MB')).toBeInTheDocument()
      })
    })

    it('uploads valid files', async () => {
      vi.mocked(contractService.uploadDocument).mockResolvedValue({
        id: 'doc-123',
        filename: 'contract.pdf',
        size: 1024000
      })
      
      render(<ContractCreatePage />)
      
      const file = new File(['content'], 'contract.pdf', { type: 'application/pdf' })
      const input = screen.getByLabelText(/file upload/i)
      await user.upload(input, file)
      
      await waitFor(() => {
        expect(screen.getByText('contract.pdf')).toBeInTheDocument()
      })
    })
  })

  describe('AI Features', () => {
    it('shows risk assessment preview', async () => {
      vi.mocked(contractService.getRiskAssessment).mockResolvedValue({
        overall_risk: 'medium',
        risk_score: 60,
        risk_factors: [
          { factor: 'Payment terms', severity: 'medium' }
        ]
      })
      
      render(<ContractCreatePage />)
      
      // Navigate to terms step
      await user.type(screen.getByLabelText(/contract title/i), 'Test Contract')
      await user.selectOptions(screen.getByLabelText(/contract type/i), 'purchase')
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await user.type(screen.getByLabelText(/counterparty name/i), 'ACME Corp')
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => {
        expect(screen.getByText('Risk Assessment')).toBeInTheDocument()
        expect(screen.getByText('Medium Risk')).toBeInTheDocument()
      })
    })

    it('detects missing clauses', async () => {
      vi.mocked(contractService.suggestClauses).mockResolvedValue({
        missing_clauses: ['liability', 'confidentiality'],
        recommendations: ['Add liability clause for better protection']
      })
      
      render(<ContractCreatePage />)
      
      await waitFor(() => {
        expect(screen.getByText('Missing Clauses Detected')).toBeInTheDocument()
        expect(screen.getByText('liability')).toBeInTheDocument()
        expect(screen.getByText('confidentiality')).toBeInTheDocument()
      })
    })
  })

  describe('Navigation and Cancellation', () => {
    it('shows confirmation dialog when cancelling', async () => {
      render(<ContractCreatePage />)
      
      await user.type(screen.getByLabelText(/contract title/i), 'Test Data')
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)
      
      await waitFor(() => {
        expect(screen.getByText('Discard Changes?')).toBeInTheDocument()
        expect(screen.getByText('You have unsaved changes')).toBeInTheDocument()
      })
    })

    it('navigates back without confirmation if no changes', async () => {
      render(<ContractCreatePage />)
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)
      
      expect(mockNavigate).toHaveBeenCalledWith('/contracts')
    })

    it('prevents navigation when there are validation errors', async () => {
      render(<ContractCreatePage />)
      
      // Try to navigate to next step without filling required fields
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      // Should stay on step 1
      expect(screen.getByText('Step 1 of 4: Basic Information')).toBeInTheDocument()
      expect(screen.getByText('Title is required')).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('shows loading state during contract creation', async () => {
      // Simulate slow API response
      vi.mocked(contractService.createContract).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      )
      
      render(<ContractCreatePage />)
      
      // Navigate to final step and submit
      await user.type(screen.getByLabelText(/contract title/i), 'Test Contract')
      await user.selectOptions(screen.getByLabelText(/contract type/i), 'purchase')
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await user.type(screen.getByLabelText(/counterparty name/i), 'ACME Corp')
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      const submitButton = screen.getByRole('button', { name: /create contract/i })
      await user.click(submitButton)
      
      expect(screen.getByText('Creating contract...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })

    it('shows loading state during AI suggestions', async () => {
      vi.mocked(contractService.suggestClauses).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 500))
      )
      
      render(<ContractCreatePage />)
      
      await user.type(screen.getByLabelText(/contract title/i), 'AI Contract')
      
      await waitFor(() => {
        expect(screen.getByText('Analyzing...')).toBeInTheDocument()
      })
    })
  })

  describe('Responsive Design', () => {
    it('adapts layout for mobile devices', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375 })
      Object.defineProperty(window, 'innerHeight', { value: 667 })
      
      render(<ContractCreatePage />)
      
      expect(screen.getByTestId('mobile-stepper')).toBeInTheDocument()
    })

    it('uses desktop layout for larger screens', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', { value: 1024 })
      Object.defineProperty(window, 'innerHeight', { value: 768 })
      
      render(<ContractCreatePage />)
      
      expect(screen.getByTestId('desktop-stepper')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('provides proper ARIA labels', async () => {
      render(<ContractCreatePage />)
      
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Contract creation wizard')
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', 'Creation progress')
    })

    it('supports keyboard navigation', async () => {
      render(<ContractCreatePage />)
      
      const titleInput = screen.getByLabelText(/contract title/i)
      titleInput.focus()
      
      // Tab to next field
      await user.keyboard('{Tab}')
      expect(screen.getByLabelText(/contract type/i)).toHaveFocus()
      
      // Tab to next button
      await user.keyboard('{Tab}{Tab}')
      expect(screen.getByRole('button', { name: /next/i })).toHaveFocus()
    })

    it('announces step changes to screen readers', async () => {
      render(<ContractCreatePage />)
      
      await user.type(screen.getByLabelText(/contract title/i), 'Test Contract')
      await user.selectOptions(screen.getByLabelText(/contract type/i), 'purchase')
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(
          'Moved to step 2 of 4: Parties & Stakeholders'
        )
      })
    })
  })
})