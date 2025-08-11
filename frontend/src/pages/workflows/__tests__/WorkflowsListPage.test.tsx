/**
 * @jest-environment jsdom
 * Comprehensive test suite for WorkflowsListPage
 * Tests all requirements including search, filtering, sorting, bulk operations, and view modes
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock the workflow service first
vi.mock('../../../services/workflow.service', () => ({
  workflowService: {
    getWorkflows: vi.fn(),
    getWorkflowStats: vi.fn(),
    bulkUpdateWorkflows: vi.fn(),
    exportWorkflows: vi.fn(),
    importWorkflow: vi.fn(),
    deleteWorkflow: vi.fn(),
    cloneWorkflow: vi.fn(),
    activateWorkflow: vi.fn(),
    deactivateWorkflow: vi.fn(),
    getWorkflowVersions: vi.fn(),
    compareWorkflowVersions: vi.fn(),
    getWorkflowTemplates: vi.fn(),
    getWorkflowUsageAnalytics: vi.fn(),
    getAssignees: vi.fn(),
  }
}))

// Mock auth store
vi.mock('../../../store/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: {
      id: 'user1',
      name: 'Test User',
      permissions: ['create_workflows', 'edit_workflows', 'delete_workflows', 'export_workflows']
    }
  }))
}))

import WorkflowsListPage from '../WorkflowsListPage'
import { workflowService } from '../../../services/workflow.service'

// Cast to get access to mock functions
const mockWorkflowService = workflowService as any

// Mock file system access API for import
Object.defineProperty(window, 'showOpenFilePicker', {
  writable: true,
  value: vi.fn()
})

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

// Mock workflow data
const mockWorkflows = [
  {
    id: 'workflow1',
    name: 'Contract Review Process',
    description: 'Standard legal contract review workflow',
    status: 'Active' as const,
    category: 'Legal' as const,
    version: '1.2.0',
    lastModified: '2024-01-15T10:30:00Z',
    createdBy: { id: 'user1', name: 'John Doe', email: 'john@example.com' },
    createdAt: '2024-01-01T10:00:00Z',
    tags: ['contract', 'review', 'legal'],
    usageCount: 45,
    isTemplate: false,
    templateId: null,
    steps: 5,
    avgCompletionTime: 72, // hours
    successRate: 95.2,
  },
  {
    id: 'workflow2',
    name: 'Document Approval Workflow',
    description: 'Multi-stage document approval process',
    status: 'Draft' as const,
    category: 'Approval' as const,
    version: '2.1.0',
    lastModified: '2024-01-10T14:20:00Z',
    createdBy: { id: 'user2', name: 'Jane Smith', email: 'jane@example.com' },
    createdAt: '2023-12-15T09:00:00Z',
    tags: ['approval', 'document', 'multi-stage'],
    usageCount: 23,
    isTemplate: true,
    templateId: 'template1',
    steps: 3,
    avgCompletionTime: 48,
    successRate: 98.1,
  },
  {
    id: 'workflow3',
    name: 'Risk Assessment Process',
    description: 'Comprehensive risk evaluation workflow',
    status: 'Inactive' as const,
    category: 'Risk' as const,
    version: '1.0.0',
    lastModified: '2023-12-20T16:45:00Z',
    createdBy: { id: 'user3', name: 'Bob Johnson', email: 'bob@example.com' },
    createdAt: '2023-11-01T11:30:00Z',
    tags: ['risk', 'assessment', 'evaluation'],
    usageCount: 12,
    isTemplate: false,
    templateId: null,
    steps: 8,
    avgCompletionTime: 120,
    successRate: 87.5,
  }
]

const mockWorkflowStats = {
  total: 156,
  active: 89,
  draft: 34,
  inactive: 33,
  templates: 15,
  totalUsage: 2340,
  avgSuccessRate: 92.4,
  byCategory: {
    Legal: 45,
    Approval: 38,
    Risk: 28,
    Compliance: 25,
    HR: 20
  }
}

const mockWorkflowTemplates = [
  {
    id: 'template1',
    name: 'Basic Approval Template',
    description: 'Simple two-stage approval process',
    category: 'Approval' as const,
    steps: 2,
    estimatedTime: 24,
    popularity: 85
  },
  {
    id: 'template2',
    name: 'Legal Review Template',
    description: 'Comprehensive legal document review',
    category: 'Legal' as const,
    steps: 4,
    estimatedTime: 72,
    popularity: 92
  }
]

const mockVersions = [
  {
    version: '1.2.0',
    createdAt: '2024-01-15T10:30:00Z',
    createdBy: 'John Doe',
    changes: 'Added parallel approval step',
    status: 'Current' as const
  },
  {
    version: '1.1.0',
    createdAt: '2024-01-01T10:00:00Z',
    createdBy: 'John Doe',
    changes: 'Initial version',
    status: 'Archived' as const
  }
]

const mockUsageAnalytics = {
  workflowId: 'workflow1',
  totalExecutions: 45,
  successfulExecutions: 43,
  averageCompletionTime: 72,
  executionsByMonth: [
    { month: '2024-01', count: 15 },
    { month: '2023-12', count: 18 },
    { month: '2023-11', count: 12 }
  ],
  bottlenecks: [
    { stepName: 'Legal Review', avgTime: 48, percentage: 67 },
    { stepName: 'Final Approval', avgTime: 16, percentage: 22 }
  ]
}

describe('WorkflowsListPage', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
    
    // Set up default mock implementations
    mockWorkflowService.getWorkflows.mockResolvedValue({
      workflows: mockWorkflows,
      total: mockWorkflows.length,
      page: 1,
      perPage: 25,
      totalPages: 1
    })
    mockWorkflowService.getWorkflowStats.mockResolvedValue(mockWorkflowStats)
    mockWorkflowService.getWorkflowTemplates.mockResolvedValue(mockWorkflowTemplates)
    mockWorkflowService.getAssignees.mockResolvedValue([
      { id: 'user1', name: 'John Doe', email: 'john@example.com' },
      { id: 'user2', name: 'Jane Smith', email: 'jane@example.com' }
    ])
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('Basic Rendering', () => {
    it('renders the page title and basic structure', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      expect(screen.getByText('Workflows')).toBeInTheDocument()
      expect(screen.getByRole('main', { name: /workflows list/i })).toBeInTheDocument()
      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument()
    })

    it('displays workflow statistics', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('total-workflows')).toHaveTextContent('156')
        expect(screen.getByTestId('active-workflows')).toHaveTextContent('89')
        expect(screen.getByTestId('draft-workflows')).toHaveTextContent('34')
        expect(screen.getByTestId('template-workflows')).toHaveTextContent('15')
      })
    })

    it('displays workflows in list format by default', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('workflows-table')).toBeInTheDocument()
        expect(screen.getByText('Contract Review Process')).toBeInTheDocument()
        expect(screen.getByText('Document Approval Workflow')).toBeInTheDocument()
        expect(screen.getByText('Risk Assessment Process')).toBeInTheDocument()
      })
    })

    it('handles loading state', () => {
      mockWorkflowService.getWorkflows.mockImplementation(() => new Promise(() => {}))
      
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      expect(screen.getByTestId('workflows-loading')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('handles error state', async () => {
      mockWorkflowService.getWorkflows.mockRejectedValue(new Error('API Error'))
      
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Failed to load workflows')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })
  })

  describe('Search Functionality', () => {
    it('filters workflows by name', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const searchInput = screen.getByPlaceholderText('Search workflows...')
      await user.type(searchInput, 'Contract')

      await waitFor(() => {
        expect(mockWorkflowService.getWorkflows).toHaveBeenCalledWith(
          expect.objectContaining({
            searchQuery: 'Contract'
          }),
          expect.any(Object),
          1,
          25
        )
      })
    })

    it('filters workflows by description', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const searchInput = screen.getByPlaceholderText('Search workflows...')
      await user.type(searchInput, 'approval process')

      await waitFor(() => {
        expect(mockWorkflowService.getWorkflows).toHaveBeenCalledWith(
          expect.objectContaining({
            searchQuery: 'approval process'
          }),
          expect.any(Object),
          1,
          25
        )
      })
    })

    it('filters workflows by tags', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const searchInput = screen.getByPlaceholderText('Search workflows...')
      await user.type(searchInput, 'legal')

      await waitFor(() => {
        expect(mockWorkflowService.getWorkflows).toHaveBeenCalledWith(
          expect.objectContaining({
            searchQuery: 'legal'
          }),
          expect.any(Object),
          1,
          25
        )
      })
    })

    it('clears search when clear button is clicked', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const searchInput = screen.getByPlaceholderText('Search workflows...')
      await user.type(searchInput, 'test query')

      const clearButton = screen.getByRole('button', { name: /clear search/i })
      await user.click(clearButton)

      expect(searchInput).toHaveValue('')
    })
  })

  describe('Filtering', () => {
    it('filters by status', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const statusFilter = screen.getByLabelText('Status filter')
      await user.selectOptions(statusFilter, 'Active')

      await waitFor(() => {
        expect(mockWorkflowService.getWorkflows).toHaveBeenCalledWith(
          expect.objectContaining({
            status: ['Active']
          }),
          expect.any(Object),
          1,
          25
        )
      })
    })

    it('filters by category', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const categoryFilter = screen.getByLabelText('Category filter')
      await user.selectOptions(categoryFilter, 'Legal')

      await waitFor(() => {
        expect(mockWorkflowService.getWorkflows).toHaveBeenCalledWith(
          expect.objectContaining({
            category: ['Legal']
          }),
          expect.any(Object),
          1,
          25
        )
      })
    })

    it('filters by created date range', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const startDateFilter = screen.getByLabelText('Created after')
      const endDateFilter = screen.getByLabelText('Created before')
      
      await user.type(startDateFilter, '2024-01-01')
      await user.type(endDateFilter, '2024-01-31')

      await waitFor(() => {
        expect(mockWorkflowService.getWorkflows).toHaveBeenCalledWith(
          expect.objectContaining({
            createdAfter: '2024-01-01',
            createdBefore: '2024-01-31'
          }),
          expect.any(Object),
          1,
          25
        )
      })
    })

    it('filters by modified date range', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const modifiedAfterFilter = screen.getByLabelText('Modified after')
      const modifiedBeforeFilter = screen.getByLabelText('Modified before')
      
      await user.type(modifiedAfterFilter, '2024-01-01')
      await user.type(modifiedBeforeFilter, '2024-01-31')

      await waitFor(() => {
        expect(mockWorkflowService.getWorkflows).toHaveBeenCalledWith(
          expect.objectContaining({
            modifiedAfter: '2024-01-01',
            modifiedBefore: '2024-01-31'
          }),
          expect.any(Object),
          1,
          25
        )
      })
    })

    it('filters by owner', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const ownerFilter = screen.getByLabelText('Owner filter')
      await user.selectOptions(ownerFilter, 'user1')

      await waitFor(() => {
        expect(mockWorkflowService.getWorkflows).toHaveBeenCalledWith(
          expect.objectContaining({
            ownerId: ['user1']
          }),
          expect.any(Object),
          1,
          25
        )
      })
    })

    it('clears all filters', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      // Set some filters
      const statusFilter = screen.getByLabelText('Status filter')
      await user.selectOptions(statusFilter, 'Active')
      
      const categoryFilter = screen.getByLabelText('Category filter')
      await user.selectOptions(categoryFilter, 'Legal')

      // Clear filters
      const clearButton = screen.getByRole('button', { name: /clear filters/i })
      await user.click(clearButton)

      expect(statusFilter).toHaveValue('')
      expect(categoryFilter).toHaveValue('')
    })
  })

  describe('Sorting', () => {
    it('sorts by name ascending', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const nameHeader = screen.getByRole('columnheader', { name: /name/i })
      await user.click(nameHeader)

      await waitFor(() => {
        expect(mockWorkflowService.getWorkflows).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            field: 'name',
            order: 'asc'
          }),
          1,
          25
        )
      })
    })

    it('sorts by name descending on second click', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const nameHeader = screen.getByRole('columnheader', { name: /name/i })
      await user.click(nameHeader) // First click for asc
      await user.click(nameHeader) // Second click for desc

      await waitFor(() => {
        expect(mockWorkflowService.getWorkflows).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            field: 'name',
            order: 'desc'
          }),
          1,
          25
        )
      })
    })

    it('sorts by created date', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const createdHeader = screen.getByRole('columnheader', { name: /created/i })
      await user.click(createdHeader)

      await waitFor(() => {
        expect(mockWorkflowService.getWorkflows).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            field: 'createdAt',
            order: 'asc'
          }),
          1,
          25
        )
      })
    })

    it('sorts by modified date', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const modifiedHeader = screen.getByRole('columnheader', { name: /modified/i })
      await user.click(modifiedHeader)

      await waitFor(() => {
        expect(mockWorkflowService.getWorkflows).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            field: 'lastModified',
            order: 'asc'
          }),
          1,
          25
        )
      })
    })

    it('sorts by usage count', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const usageHeader = screen.getByRole('columnheader', { name: /usage/i })
      await user.click(usageHeader)

      await waitFor(() => {
        expect(mockWorkflowService.getWorkflows).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            field: 'usageCount',
            order: 'asc'
          }),
          1,
          25
        )
      })
    })
  })

  describe('View Modes', () => {
    it('switches to grid view', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const gridViewButton = screen.getByRole('button', { name: /grid view/i })
      await user.click(gridViewButton)

      expect(screen.getByTestId('workflows-grid')).toBeInTheDocument()
      expect(screen.queryByTestId('workflows-table')).not.toBeInTheDocument()
    })

    it('switches back to table view', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      // Switch to grid first
      const gridViewButton = screen.getByRole('button', { name: /grid view/i })
      await user.click(gridViewButton)

      // Switch back to table
      const tableViewButton = screen.getByRole('button', { name: /table view/i })
      await user.click(tableViewButton)

      expect(screen.getByTestId('workflows-table')).toBeInTheDocument()
      expect(screen.queryByTestId('workflows-grid')).not.toBeInTheDocument()
    })

    it('displays workflow cards in grid view', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const gridViewButton = screen.getByRole('button', { name: /grid view/i })
      await user.click(gridViewButton)

      expect(screen.getByTestId('workflow-card-workflow1')).toBeInTheDocument()
      expect(screen.getByTestId('workflow-card-workflow2')).toBeInTheDocument()
      expect(screen.getByTestId('workflow-card-workflow3')).toBeInTheDocument()
    })
  })

  describe('Workflow Actions', () => {
    it('creates new workflow', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const createButton = screen.getByRole('button', { name: /create new/i })
      await user.click(createButton)

      expect(screen.getByRole('dialog', { name: /create workflow/i })).toBeInTheDocument()
    })

    it('edits workflow', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      await waitFor(() => {
        const editButton = screen.getByTestId('edit-workflow-workflow1')
        expect(editButton).toBeInTheDocument()
      })

      const editButton = screen.getByTestId('edit-workflow-workflow1')
      await user.click(editButton)

      // Should navigate to edit page - we'll verify this through the router mock
      // For now, we'll just verify the button exists and is clickable
      expect(editButton).toBeEnabled()
    })

    it('clones workflow', async () => {
      mockWorkflowService.cloneWorkflow.mockResolvedValue({ id: 'workflow1_clone' })

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const cloneButton = screen.getByTestId('clone-workflow-workflow1')
      await user.click(cloneButton)

      await waitFor(() => {
        expect(mockWorkflowService.cloneWorkflow).toHaveBeenCalledWith('workflow1')
        expect(screen.getByText('Workflow cloned successfully')).toBeInTheDocument()
      })
    })

    it('activates workflow', async () => {
      mockWorkflowService.activateWorkflow.mockResolvedValue(mockWorkflows[0])

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const activateButton = screen.getByTestId('activate-workflow-workflow2')
      await user.click(activateButton)

      await waitFor(() => {
        expect(mockWorkflowService.activateWorkflow).toHaveBeenCalledWith('workflow2')
        expect(screen.getByText('Workflow activated successfully')).toBeInTheDocument()
      })
    })

    it('deactivates workflow', async () => {
      mockWorkflowService.deactivateWorkflow.mockResolvedValue(mockWorkflows[0])

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const deactivateButton = screen.getByTestId('deactivate-workflow-workflow1')
      await user.click(deactivateButton)

      await waitFor(() => {
        expect(mockWorkflowService.deactivateWorkflow).toHaveBeenCalledWith('workflow1')
        expect(screen.getByText('Workflow deactivated successfully')).toBeInTheDocument()
      })
    })

    it('deletes workflow with confirmation', async () => {
      mockWorkflowService.deleteWorkflow.mockResolvedValue(undefined)

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const deleteButton = screen.getByTestId('delete-workflow-workflow1')
      await user.click(deleteButton)

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /confirm delete/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(mockWorkflowService.deleteWorkflow).toHaveBeenCalledWith('workflow1')
        expect(screen.getByText('Workflow deleted successfully')).toBeInTheDocument()
      })
    })

    it('cancels deletion', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const deleteButton = screen.getByTestId('delete-workflow-workflow1')
      await user.click(deleteButton)

      // Cancel deletion
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockWorkflowService.deleteWorkflow).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('exports workflow', async () => {
      const mockBlob = new Blob(['workflow data'], { type: 'application/json' })
      mockWorkflowService.exportWorkflows.mockResolvedValue(mockBlob)

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const exportButton = screen.getByTestId('export-workflow-workflow1')
      await user.click(exportButton)

      await waitFor(() => {
        expect(mockWorkflowService.exportWorkflows).toHaveBeenCalledWith({
          workflowIds: ['workflow1'],
          format: 'json'
        })
      })
    })

    it('views workflow history', async () => {
      mockWorkflowService.getWorkflowVersions.mockResolvedValue(mockVersions)

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const historyButton = screen.getByTestId('history-workflow-workflow1')
      await user.click(historyButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /workflow history/i })).toBeInTheDocument()
        expect(screen.getByText('1.2.0')).toBeInTheDocument()
        expect(screen.getByText('1.1.0')).toBeInTheDocument()
      })
    })
  })

  describe('Bulk Operations', () => {
    beforeEach(async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      // Wait for workflows to load
      await waitFor(() => {
        expect(screen.getByText('Contract Review Process')).toBeInTheDocument()
      })
    })

    it('selects multiple workflows', async () => {
      const checkbox1 = screen.getByTestId('select-workflow-workflow1')
      const checkbox2 = screen.getByTestId('select-workflow-workflow2')

      await user.click(checkbox1)
      await user.click(checkbox2)

      expect(checkbox1).toBeChecked()
      expect(checkbox2).toBeChecked()
      expect(screen.getByTestId('bulk-operations-bar')).toBeInTheDocument()
      expect(screen.getByText('2 workflows selected')).toBeInTheDocument()
    })

    it('selects all workflows', async () => {
      const selectAllCheckbox = screen.getByTestId('select-all-workflows')
      await user.click(selectAllCheckbox)

      expect(screen.getByText('3 workflows selected')).toBeInTheDocument()
    })

    it('bulk deletes selected workflows', async () => {
      mockWorkflowService.bulkUpdateWorkflows.mockResolvedValue([])

      const checkbox1 = screen.getByTestId('select-workflow-workflow1')
      const checkbox2 = screen.getByTestId('select-workflow-workflow2')
      
      await user.click(checkbox1)
      await user.click(checkbox2)

      const bulkDeleteButton = screen.getByRole('button', { name: /delete selected/i })
      await user.click(bulkDeleteButton)

      const confirmButton = screen.getByRole('button', { name: /confirm delete/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(mockWorkflowService.bulkUpdateWorkflows).toHaveBeenCalledWith({
          workflowIds: ['workflow1', 'workflow2'],
          action: 'delete'
        })
      })
    })

    it('bulk exports selected workflows', async () => {
      const mockBlob = new Blob(['workflows data'], { type: 'application/json' })
      mockWorkflowService.exportWorkflows.mockResolvedValue(mockBlob)

      const checkbox1 = screen.getByTestId('select-workflow-workflow1')
      const checkbox2 = screen.getByTestId('select-workflow-workflow2')
      
      await user.click(checkbox1)
      await user.click(checkbox2)

      const bulkExportButton = screen.getByRole('button', { name: /export selected/i })
      await user.click(bulkExportButton)

      await waitFor(() => {
        expect(mockWorkflowService.exportWorkflows).toHaveBeenCalledWith({
          workflowIds: ['workflow1', 'workflow2'],
          format: 'json'
        })
      })
    })

    it('bulk changes status of selected workflows', async () => {
      mockWorkflowService.bulkUpdateWorkflows.mockResolvedValue([])

      const checkbox1 = screen.getByTestId('select-workflow-workflow1')
      const checkbox2 = screen.getByTestId('select-workflow-workflow2')
      
      await user.click(checkbox1)
      await user.click(checkbox2)

      const bulkStatusButton = screen.getByRole('button', { name: /change status/i })
      await user.click(bulkStatusButton)

      const activeOption = screen.getByRole('button', { name: /set to active/i })
      await user.click(activeOption)

      await waitFor(() => {
        expect(mockWorkflowService.bulkUpdateWorkflows).toHaveBeenCalledWith({
          workflowIds: ['workflow1', 'workflow2'],
          action: 'updateStatus',
          status: 'Active'
        })
      })
    })
  })

  describe('Import/Export', () => {
    it('imports workflow from file', async () => {
      const mockFile = new File(['{"name": "Test Workflow"}'], 'workflow.json', { type: 'application/json' })
      mockWorkflowService.importWorkflow.mockResolvedValue({ id: 'imported-workflow' })

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const importButton = screen.getByRole('button', { name: /import/i })
      await user.click(importButton)

      const fileInput = screen.getByLabelText(/choose file/i)
      await user.upload(fileInput, mockFile)

      const confirmButton = screen.getByRole('button', { name: /import workflow/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(mockWorkflowService.importWorkflow).toHaveBeenCalledWith(mockFile)
        expect(screen.getByText('Workflow imported successfully')).toBeInTheDocument()
      })
    })

    it('imports workflow from BPMN file', async () => {
      const mockFile = new File(['<bpmn></bpmn>'], 'workflow.bpmn', { type: 'application/xml' })
      mockWorkflowService.importWorkflow.mockResolvedValue({ id: 'imported-bpmn-workflow' })

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const importButton = screen.getByRole('button', { name: /import/i })
      await user.click(importButton)

      const fileInput = screen.getByLabelText(/choose file/i)
      await user.upload(fileInput, mockFile)

      const confirmButton = screen.getByRole('button', { name: /import workflow/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(mockWorkflowService.importWorkflow).toHaveBeenCalledWith(mockFile)
      })
    })

    it('validates import file format', async () => {
      const mockFile = new File(['invalid content'], 'workflow.txt', { type: 'text/plain' })

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const importButton = screen.getByRole('button', { name: /import/i })
      await user.click(importButton)

      const fileInput = screen.getByLabelText(/choose file/i)
      await user.upload(fileInput, mockFile)

      expect(screen.getByText('Invalid file format. Please select a JSON or BPMN file.')).toBeInTheDocument()
    })

    it('exports all workflows', async () => {
      const mockBlob = new Blob(['all workflows data'], { type: 'application/json' })
      mockWorkflowService.exportWorkflows.mockResolvedValue(mockBlob)

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const exportButton = screen.getByRole('button', { name: /export all/i })
      await user.click(exportButton)

      await waitFor(() => {
        expect(mockWorkflowService.exportWorkflows).toHaveBeenCalledWith({
          format: 'json'
        })
      })
    })
  })

  describe('Workflow Templates Gallery', () => {
    it('displays workflow templates', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const templatesButton = screen.getByRole('button', { name: /templates/i })
      await user.click(templatesButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /workflow templates/i })).toBeInTheDocument()
        expect(screen.getByText('Basic Approval Template')).toBeInTheDocument()
        expect(screen.getByText('Legal Review Template')).toBeInTheDocument()
      })
    })

    it('creates workflow from template', async () => {
      mockWorkflowService.cloneWorkflow.mockResolvedValue({ id: 'workflow-from-template' })

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const templatesButton = screen.getByRole('button', { name: /templates/i })
      await user.click(templatesButton)

      await waitFor(() => {
        const useTemplateButton = screen.getByTestId('use-template-template1')
        expect(useTemplateButton).toBeInTheDocument()
      })

      const useTemplateButton = screen.getByTestId('use-template-template1')
      await user.click(useTemplateButton)

      await waitFor(() => {
        expect(mockWorkflowService.cloneWorkflow).toHaveBeenCalledWith('template1', { isTemplate: false })
      })
    })
  })

  describe('Usage Analytics', () => {
    it('displays usage analytics for workflow', async () => {
      mockWorkflowService.getWorkflowUsageAnalytics.mockResolvedValue(mockUsageAnalytics)

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const analyticsButton = screen.getByTestId('analytics-workflow-workflow1')
      await user.click(analyticsButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /usage analytics/i })).toBeInTheDocument()
        expect(screen.getByText('45 executions')).toBeInTheDocument()
        expect(screen.getByText('95.6% success rate')).toBeInTheDocument()
        expect(screen.getByText('72 hours avg completion')).toBeInTheDocument()
      })
    })

    it('displays execution trend chart', async () => {
      mockWorkflowService.getWorkflowUsageAnalytics.mockResolvedValue(mockUsageAnalytics)

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const analyticsButton = screen.getByTestId('analytics-workflow-workflow1')
      await user.click(analyticsButton)

      await waitFor(() => {
        expect(screen.getByTestId('execution-trend-chart')).toBeInTheDocument()
      })
    })

    it('identifies bottlenecks', async () => {
      mockWorkflowService.getWorkflowUsageAnalytics.mockResolvedValue(mockUsageAnalytics)

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const analyticsButton = screen.getByTestId('analytics-workflow-workflow1')
      await user.click(analyticsButton)

      await waitFor(() => {
        expect(screen.getByText('Legal Review')).toBeInTheDocument()
        expect(screen.getByText('67%')).toBeInTheDocument()
        expect(screen.getByText('Final Approval')).toBeInTheDocument()
        expect(screen.getByText('22%')).toBeInTheDocument()
      })
    })
  })

  describe('Version Comparison', () => {
    it('compares workflow versions', async () => {
      const mockComparison = {
        version1: '1.1.0',
        version2: '1.2.0',
        differences: [
          { type: 'added', description: 'Added parallel approval step' },
          { type: 'modified', description: 'Updated timeout settings' }
        ]
      }
      mockWorkflowService.compareWorkflowVersions.mockResolvedValue(mockComparison)

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const historyButton = screen.getByTestId('history-workflow-workflow1')
      await user.click(historyButton)

      await waitFor(() => {
        const compareButton = screen.getByTestId('compare-versions')
        expect(compareButton).toBeInTheDocument()
      })

      const compareButton = screen.getByTestId('compare-versions')
      await user.click(compareButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /version comparison/i })).toBeInTheDocument()
        expect(screen.getByText('Added parallel approval step')).toBeInTheDocument()
        expect(screen.getByText('Updated timeout settings')).toBeInTheDocument()
      })
    })
  })

  describe('Pagination', () => {
    it('navigates to next page', async () => {
      // Mock more workflows for pagination
      mockWorkflowService.getWorkflows.mockResolvedValue({
        workflows: mockWorkflows,
        total: 50,
        page: 1,
        perPage: 25,
        totalPages: 2
      })

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      await waitFor(() => {
        const nextButton = screen.getByLabelText('Next page')
        expect(nextButton).toBeInTheDocument()
        expect(nextButton).toBeEnabled()
      })

      const nextButton = screen.getByLabelText('Next page')
      await user.click(nextButton)

      await waitFor(() => {
        expect(mockWorkflowService.getWorkflows).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          2,
          25
        )
      })
    })

    it('changes items per page', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const itemsPerPageSelect = screen.getByLabelText('Items per page')
      await user.selectOptions(itemsPerPageSelect, '50')

      await waitFor(() => {
        expect(mockWorkflowService.getWorkflows).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          1,
          50
        )
      })
    })
  })

  describe('Quick Preview on Hover', () => {
    it('shows workflow preview on hover', async () => {
      vi.useFakeTimers()

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      await waitFor(() => {
        const workflowRow = screen.getByTestId('workflow-row-workflow1')
        expect(workflowRow).toBeInTheDocument()
      })

      const workflowRow = screen.getByTestId('workflow-row-workflow1')
      fireEvent.mouseEnter(workflowRow)

      // Fast forward to trigger hover delay
      vi.advanceTimersByTime(500)

      await waitFor(() => {
        expect(screen.getByTestId('workflow-preview-workflow1')).toBeInTheDocument()
        expect(screen.getByText('5 steps')).toBeInTheDocument()
        expect(screen.getByText('72 hours avg')).toBeInTheDocument()
        expect(screen.getByText('95.2% success')).toBeInTheDocument()
      })

      vi.useRealTimers()
    })

    it('hides preview on mouse leave', async () => {
      vi.useFakeTimers()

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const workflowRow = screen.getByTestId('workflow-row-workflow1')
      fireEvent.mouseEnter(workflowRow)
      vi.advanceTimersByTime(500)

      fireEvent.mouseLeave(workflowRow)

      await waitFor(() => {
        expect(screen.queryByTestId('workflow-preview-workflow1')).not.toBeInTheDocument()
      })

      vi.useRealTimers()
    })
  })

  describe('Tags Management', () => {
    it('displays workflow tags', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('tag-contract')).toBeInTheDocument()
        expect(screen.getByTestId('tag-review')).toBeInTheDocument()
        expect(screen.getByTestId('tag-legal')).toBeInTheDocument()
      })
    })

    it('filters by tag', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const contractTag = screen.getByTestId('tag-contract')
      await user.click(contractTag)

      await waitFor(() => {
        expect(mockWorkflowService.getWorkflows).toHaveBeenCalledWith(
          expect.objectContaining({
            tags: ['contract']
          }),
          expect.any(Object),
          1,
          25
        )
      })
    })

    it('adds tag to workflow', async () => {
      mockWorkflowService.bulkUpdateWorkflows.mockResolvedValue([])

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const addTagButton = screen.getByTestId('add-tag-workflow1')
      await user.click(addTagButton)

      const tagInput = screen.getByPlaceholderText('Enter tag name')
      await user.type(tagInput, 'urgent')

      const saveTagButton = screen.getByRole('button', { name: /add tag/i })
      await user.click(saveTagButton)

      await waitFor(() => {
        expect(mockWorkflowService.bulkUpdateWorkflows).toHaveBeenCalledWith({
          workflowIds: ['workflow1'],
          action: 'addTag',
          tag: 'urgent'
        })
      })
    })
  })

  describe('Keyboard Navigation', () => {
    it('navigates table with arrow keys', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      await waitFor(() => {
        const firstRow = screen.getByTestId('workflow-row-workflow1')
        firstRow.focus()
      })

      fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })

      expect(screen.getByTestId('workflow-row-workflow2')).toHaveFocus()
    })

    it('opens workflow with Enter key', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      await waitFor(() => {
        const firstRow = screen.getByTestId('workflow-row-workflow1')
        firstRow.focus()
      })

      fireEvent.keyDown(document.activeElement!, { key: 'Enter' })

      // Should navigate to workflow details - verify through router mock
      // For now, we'll just verify the key handler exists
      expect(screen.getByTestId('workflow-row-workflow1')).toHaveFocus()
    })

    it('selects workflow with Space key', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      await waitFor(() => {
        const firstRow = screen.getByTestId('workflow-row-workflow1')
        firstRow.focus()
      })

      fireEvent.keyDown(document.activeElement!, { key: ' ' })

      expect(screen.getByTestId('select-workflow-workflow1')).toBeChecked()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      expect(screen.getByRole('main', { name: /workflows list/i })).toBeInTheDocument()
      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument()
      expect(screen.getByRole('table', { name: /workflows table/i })).toBeInTheDocument()
      expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument()
    })

    it('supports screen reader announcements', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const searchInput = screen.getByPlaceholderText('Search workflows...')
      await user.type(searchInput, 'Contract')

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Searching workflows...')
      })
    })

    it('has proper heading hierarchy', async () => {
      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1).toHaveTextContent('Workflows')

      const h2Elements = screen.getAllByRole('heading', { level: 2 })
      expect(h2Elements.length).toBeGreaterThan(0)
    })
  })

  describe('Performance', () => {
    it('debounces search input', async () => {
      vi.useFakeTimers()

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const searchInput = screen.getByPlaceholderText('Search workflows...')
      
      await user.type(searchInput, 'C')
      await user.type(searchInput, 'o')
      await user.type(searchInput, 'n')

      expect(mockWorkflowService.getWorkflows).not.toHaveBeenCalledWith(
        expect.objectContaining({ searchQuery: 'Con' }),
        expect.any(Object),
        expect.any(Number),
        expect.any(Number)
      )

      vi.advanceTimersByTime(300)

      await waitFor(() => {
        expect(mockWorkflowService.getWorkflows).toHaveBeenCalledWith(
          expect.objectContaining({ searchQuery: 'Con' }),
          expect.any(Object),
          1,
          25
        )
      })

      vi.useRealTimers()
    })

    it('virtualizes large lists in grid view', async () => {
      // Mock large dataset
      const largeWorkflowSet = Array.from({ length: 100 }, (_, i) => ({
        ...mockWorkflows[0],
        id: `workflow${i}`,
        name: `Workflow ${i}`
      }))

      mockWorkflowService.getWorkflows.mockResolvedValue({
        workflows: largeWorkflowSet,
        total: 100,
        page: 1,
        perPage: 100,
        totalPages: 1
      })

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      const gridViewButton = screen.getByRole('button', { name: /grid view/i })
      await user.click(gridViewButton)

      // Check that virtualization is working by verifying only visible items are rendered
      const renderedCards = screen.getAllByTestId(/workflow-card-/)
      expect(renderedCards.length).toBeLessThan(100)
    })
  })

  describe('Error Handling', () => {
    it('handles network errors gracefully', async () => {
      mockWorkflowService.getWorkflows.mockRejectedValue(new Error('Network error'))

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Failed to load workflows')).toBeInTheDocument()
        expect(screen.getByText('Network error')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })

    it('retries failed requests', async () => {
      mockWorkflowService.getWorkflows
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          workflows: mockWorkflows,
          total: mockWorkflows.length,
          page: 1,
          perPage: 25,
          totalPages: 1
        })

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Failed to load workflows')).toBeInTheDocument()
      })

      const retryButton = screen.getByRole('button', { name: /retry/i })
      await user.click(retryButton)

      await waitFor(() => {
        expect(screen.getByText('Contract Review Process')).toBeInTheDocument()
      })
    })

    it('handles partial failures in bulk operations', async () => {
      mockWorkflowService.bulkUpdateWorkflows.mockRejectedValue(
        new Error('Failed to update workflow2')
      )

      render(
        <TestWrapper>
          <WorkflowsListPage />
        </TestWrapper>
      )

      await waitFor(() => {
        const checkbox1 = screen.getByTestId('select-workflow-workflow1')
        const checkbox2 = screen.getByTestId('select-workflow-workflow2')
        
        fireEvent.click(checkbox1)
        fireEvent.click(checkbox2)
      })

      const bulkDeleteButton = screen.getByRole('button', { name: /delete selected/i })
      await user.click(bulkDeleteButton)

      const confirmButton = screen.getByRole('button', { name: /confirm delete/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to update workflow2')).toBeInTheDocument()
      })
    })
  })
})