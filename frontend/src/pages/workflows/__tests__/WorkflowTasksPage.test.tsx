/**
 * WorkflowTasksPage Test Suite
 * Comprehensive tests for workflow task management interface
 * Following strict TDD methodology - RED phase (tests will fail initially)
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import WorkflowTasksPage from '../WorkflowTasksPage'
import { workflowService } from '@/services/workflow.service'
import type { WorkflowTask, TaskStats, WorkflowStats, TaskAssignee } from '@/types/workflow.types'

// Mock the workflow service
vi.mock('@/services/workflow.service', () => ({
  workflowService: {
    getTasks: vi.fn(),
    getTask: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    startTask: vi.fn(),
    completeTask: vi.fn(),
    reassignTask: vi.fn(),
    bulkUpdateTasks: vi.fn(),
    getTaskComments: vi.fn(),
    addComment: vi.fn(),
    getTaskHistory: vi.fn(),
    uploadAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    getTaskStats: vi.fn(),
    getWorkflowStats: vi.fn(),
    exportTasks: vi.fn(),
    getCalendarEvents: vi.fn(),
    getAssignees: vi.fn(),
    delegateTask: vi.fn(),
    getOverdueTasks: vi.fn(),
    getMyTasks: vi.fn(),
    searchTasks: vi.fn(),
  },
}))

// Mock data
const mockAssignees: TaskAssignee[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'Legal Counsel',
    department: 'Legal',
    avatar: '/avatars/john.jpg',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'Senior Attorney',
    department: 'Legal',
    avatar: '/avatars/jane.jpg',
  },
]

const mockTasks: WorkflowTask[] = [
  {
    id: '1',
    title: 'Review Purchase Agreement',
    description: 'Review and approve purchase agreement with Vendor ABC',
    status: 'Pending',
    priority: 'High',
    workflow_name: 'Contract Review Process',
    workflow_type: 'Contract Review',
    assignee: mockAssignees[0],
    creator: mockAssignees[1],
    due_date: '2024-12-20T09:00:00Z',
    created_date: '2024-12-15T10:00:00Z',
    estimated_hours: 4,
    sla_hours: 48,
    tags: ['urgent', 'vendor-abc'],
    comments: [],
    attachments: [],
    checklist_items: [
      { id: '1', title: 'Review terms and conditions', completed: false },
      { id: '2', title: 'Check pricing accuracy', completed: false },
    ],
    contract_id: 'contract-123',
  },
  {
    id: '2',
    title: 'NDA Approval',
    description: 'Approve NDA for new client partnership',
    status: 'In Progress',
    priority: 'Medium',
    workflow_name: 'Document Approval',
    workflow_type: 'Document Approval',
    assignee: mockAssignees[1],
    creator: mockAssignees[0],
    due_date: '2024-12-18T17:00:00Z',
    created_date: '2024-12-16T14:00:00Z',
    estimated_hours: 2,
    sla_hours: 24,
    tags: ['nda', 'client'],
    comments: [
      {
        id: '1',
        content: 'Started review process',
        author: mockAssignees[1],
        created_at: '2024-12-16T15:00:00Z',
      },
    ],
    attachments: [],
    document_id: 'doc-456',
  },
  {
    id: '3',
    title: 'Risk Assessment Report',
    description: 'Complete risk assessment for new contract template',
    status: 'Overdue',
    priority: 'Urgent',
    workflow_name: 'Risk Analysis',
    workflow_type: 'Risk Assessment',
    assignee: mockAssignees[0],
    creator: mockAssignees[1],
    due_date: '2024-12-10T12:00:00Z',
    created_date: '2024-12-08T09:00:00Z',
    completed_date: undefined,
    estimated_hours: 8,
    actual_hours: 6,
    sla_hours: 72,
    tags: ['risk', 'template'],
    comments: [],
    attachments: [
      {
        id: '1',
        name: 'risk-template.pdf',
        size: 2048000,
        type: 'application/pdf',
        url: '/attachments/risk-template.pdf',
        uploaded_by: '1',
        uploaded_at: '2024-12-08T10:00:00Z',
      },
    ],
  },
]

const mockStats: TaskStats = {
  total: 15,
  pending: 5,
  in_progress: 4,
  completed: 4,
  overdue: 2,
  completion_rate: 0.75,
  average_completion_time_hours: 24,
  sla_compliance_rate: 0.85,
}

const mockWorkflowStats: WorkflowStats = {
  'Contract Review': {
    total_tasks: 8,
    completed_tasks: 6,
    average_completion_time_hours: 32,
    overdue_count: 1,
  },
  'Document Approval': {
    total_tasks: 5,
    completed_tasks: 4,
    average_completion_time_hours: 16,
    overdue_count: 0,
  },
}

// Test utilities
const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('WorkflowTasksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock implementations
    vi.mocked(workflowService.getTasks).mockResolvedValue({
      tasks: mockTasks,
      total: mockTasks.length,
      page: 1,
      per_page: 20,
      total_pages: 1,
      stats: mockStats,
    })
    
    vi.mocked(workflowService.getTaskStats).mockResolvedValue(mockStats)
    vi.mocked(workflowService.getWorkflowStats).mockResolvedValue(mockWorkflowStats)
    vi.mocked(workflowService.getAssignees).mockResolvedValue(mockAssignees)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Initial Render and Layout', () => {
    it('renders the main page layout with header and navigation', async () => {
      renderWithProviders(<WorkflowTasksPage />)

      expect(screen.getByRole('heading', { name: /workflow tasks/i })).toBeInTheDocument()
      expect(screen.getByRole('navigation', { name: /task filters/i })).toBeInTheDocument()
      expect(screen.getByRole('main')).toBeInTheDocument()
    })

    it('displays loading state initially', () => {
      renderWithProviders(<WorkflowTasksPage />)

      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByText(/loading tasks/i)).toBeInTheDocument()
    })

    it('loads and displays task statistics in dashboard', async () => {
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByText('15')).toBeInTheDocument() // total tasks
        expect(screen.getByText('5')).toBeInTheDocument() // pending
        expect(screen.getByText('4')).toBeInTheDocument() // in progress
        expect(screen.getByText('2')).toBeInTheDocument() // overdue
      })

      expect(screen.getByText('75%')).toBeInTheDocument() // completion rate
      expect(screen.getByText('85%')).toBeInTheDocument() // SLA compliance
    })
  })

  describe('Task List Display', () => {
    it('renders task list with all task information', async () => {
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByText('Review Purchase Agreement')).toBeInTheDocument()
        expect(screen.getByText('NDA Approval')).toBeInTheDocument()
        expect(screen.getByText('Risk Assessment Report')).toBeInTheDocument()
      })

      // Check task details
      expect(screen.getByText('Contract Review')).toBeInTheDocument()
      expect(screen.getByText('Document Approval')).toBeInTheDocument()
      expect(screen.getByText('Risk Assessment')).toBeInTheDocument()

      // Check status badges
      expect(screen.getByText('Pending')).toBeInTheDocument()
      expect(screen.getByText('In Progress')).toBeInTheDocument()
      expect(screen.getByText('Overdue')).toBeInTheDocument()

      // Check priority indicators
      expect(screen.getByText('High')).toBeInTheDocument()
      expect(screen.getByText('Medium')).toBeInTheDocument()
      expect(screen.getByText('Urgent')).toBeInTheDocument()
    })

    it('displays assignee information with avatars and names', async () => {
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      })

      // Check avatars are displayed
      const avatars = screen.getAllByRole('img', { name: /avatar/i })
      expect(avatars).toHaveLength(3) // One for each task assignee
    })

    it('shows due dates with proper formatting and overdue indicators', async () => {
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByText(/Dec 20, 2024/)).toBeInTheDocument()
        expect(screen.getByText(/Dec 18, 2024/)).toBeInTheDocument()
        expect(screen.getByText(/Dec 10, 2024/)).toBeInTheDocument()
      })

      // Check overdue indicator
      expect(screen.getByRole('alert', { name: /overdue/i })).toBeInTheDocument()
    })

    it('displays SLA indicators with time remaining', async () => {
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByText(/SLA:/)).toBeInTheDocument()
        expect(screen.getByText(/hours remaining/)).toBeInTheDocument()
      })
    })
  })

  describe('Filtering and Search', () => {
    it('renders all filter controls', async () => {
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByLabelText(/status filter/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/priority filter/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/assignee filter/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/workflow type filter/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/due date filter/i)).toBeInTheDocument()
      })
    })

    it('filters tasks by status', async () => {
      const user = userEvent.setup()
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByLabelText(/status filter/i)).toBeInTheDocument()
      })

      const statusFilter = screen.getByLabelText(/status filter/i)
      await user.click(statusFilter)
      
      const pendingOption = screen.getByRole('option', { name: /pending/i })
      await user.click(pendingOption)

      await waitFor(() => {
        expect(workflowService.getTasks).toHaveBeenCalledWith(
          expect.objectContaining({
            status: ['Pending']
          }),
          expect.any(Object),
          1,
          20
        )
      })
    })

    it('filters tasks by priority', async () => {
      const user = userEvent.setup()
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByLabelText(/priority filter/i)).toBeInTheDocument()
      })

      const priorityFilter = screen.getByLabelText(/priority filter/i)
      await user.click(priorityFilter)
      
      const highOption = screen.getByRole('option', { name: /high/i })
      await user.click(highOption)

      await waitFor(() => {
        expect(workflowService.getTasks).toHaveBeenCalledWith(
          expect.objectContaining({
            priority: ['High']
          }),
          expect.any(Object),
          1,
          20
        )
      })
    })

    it('filters tasks by assignee', async () => {
      const user = userEvent.setup()
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByLabelText(/assignee filter/i)).toBeInTheDocument()
      })

      const assigneeFilter = screen.getByLabelText(/assignee filter/i)
      await user.click(assigneeFilter)
      
      const johnOption = screen.getByRole('option', { name: /john doe/i })
      await user.click(johnOption)

      await waitFor(() => {
        expect(workflowService.getTasks).toHaveBeenCalledWith(
          expect.objectContaining({
            assignee_id: ['1']
          }),
          expect.any(Object),
          1,
          20
        )
      })
    })

    it('searches tasks by text query', async () => {
      const user = userEvent.setup()
      renderWithProviders(<WorkflowTasksPage />)

      const searchInput = screen.getByPlaceholderText(/search tasks/i)
      await user.type(searchInput, 'purchase agreement')

      await waitFor(() => {
        expect(workflowService.getTasks).toHaveBeenCalledWith(
          expect.objectContaining({
            search_query: 'purchase agreement'
          }),
          expect.any(Object),
          1,
          20
        )
      })
    })

    it('filters tasks by date range', async () => {
      const user = userEvent.setup()
      renderWithProviders(<WorkflowTasksPage />)

      const startDateInput = screen.getByLabelText(/start date/i)
      const endDateInput = screen.getByLabelText(/end date/i)

      await user.type(startDateInput, '2024-12-15')
      await user.type(endDateInput, '2024-12-20')

      await waitFor(() => {
        expect(workflowService.getTasks).toHaveBeenCalledWith(
          expect.objectContaining({
            due_date_start: '2024-12-15',
            due_date_end: '2024-12-20'
          }),
          expect.any(Object),
          1,
          20
        )
      })
    })

    it('clears all filters when reset button is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<WorkflowTasksPage />)

      // Apply some filters first
      const statusFilter = screen.getByLabelText(/status filter/i)
      await user.click(statusFilter)
      await user.click(screen.getByRole('option', { name: /pending/i }))

      // Clear filters
      const clearButton = screen.getByRole('button', { name: /clear filters/i })
      await user.click(clearButton)

      await waitFor(() => {
        expect(workflowService.getTasks).toHaveBeenCalledWith(
          {},
          expect.any(Object),
          1,
          20
        )
      })
    })
  })

  describe('Task Sorting', () => {
    it('sorts tasks by due date', async () => {
      const user = userEvent.setup()
      renderWithProviders(<WorkflowTasksPage />)

      const sortSelect = screen.getByLabelText(/sort by/i)
      await user.selectOptions(sortSelect, 'due_date')

      await waitFor(() => {
        expect(workflowService.getTasks).toHaveBeenCalledWith(
          expect.any(Object),
          { field: 'due_date', order: 'asc' },
          1,
          20
        )
      })
    })

    it('sorts tasks by priority', async () => {
      const user = userEvent.setup()
      renderWithProviders(<WorkflowTasksPage />)

      const sortSelect = screen.getByLabelText(/sort by/i)
      await user.selectOptions(sortSelect, 'priority')

      await waitFor(() => {
        expect(workflowService.getTasks).toHaveBeenCalledWith(
          expect.any(Object),
          { field: 'priority', order: 'asc' },
          1,
          20
        )
      })
    })

    it('toggles sort order when clicking order button', async () => {
      const user = userEvent.setup()
      renderWithProviders(<WorkflowTasksPage />)

      const orderButton = screen.getByRole('button', { name: /sort order/i })
      await user.click(orderButton)

      await waitFor(() => {
        expect(workflowService.getTasks).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({ order: 'desc' }),
          1,
          20
        )
      })
    })
  })

  describe('Task Actions', () => {
    it('starts a task when start button is clicked', async () => {
      const user = userEvent.setup()
      vi.mocked(workflowService.startTask).mockResolvedValue({ ...mockTasks[0], status: 'In Progress' })
      
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /start task/i })).toBeInTheDocument()
      })

      const startButton = screen.getByRole('button', { name: /start task/i })
      await user.click(startButton)

      await waitFor(() => {
        expect(workflowService.startTask).toHaveBeenCalledWith('1')
      })
    })

    it('completes a task when complete button is clicked', async () => {
      const user = userEvent.setup()
      vi.mocked(workflowService.completeTask).mockResolvedValue({ ...mockTasks[1], status: 'Completed' })
      
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /complete task/i })).toBeInTheDocument()
      })

      const completeButton = screen.getByRole('button', { name: /complete task/i })
      await user.click(completeButton)

      await waitFor(() => {
        expect(workflowService.completeTask).toHaveBeenCalledWith('2', undefined)
      })
    })

    it('opens reassign dialog when reassign button is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reassign/i })).toBeInTheDocument()
      })

      const reassignButton = screen.getByRole('button', { name: /reassign/i })
      await user.click(reassignButton)

      expect(screen.getByRole('dialog', { name: /reassign task/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/select assignee/i)).toBeInTheDocument()
    })

    it('reassigns task to selected user', async () => {
      const user = userEvent.setup()
      vi.mocked(workflowService.reassignTask).mockResolvedValue({ ...mockTasks[0], assignee: mockAssignees[1] })
      
      renderWithProviders(<WorkflowTasksPage />)

      const reassignButton = screen.getByRole('button', { name: /reassign/i })
      await user.click(reassignButton)

      const assigneeSelect = screen.getByLabelText(/select assignee/i)
      await user.selectOptions(assigneeSelect, '2')

      const confirmButton = screen.getByRole('button', { name: /confirm reassign/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(workflowService.reassignTask).toHaveBeenCalledWith('1', '2')
      })
    })
  })

  describe('Task Details Panel', () => {
    it('opens task details panel when task title is clicked', async () => {
      const user = userEvent.setup()
      vi.mocked(workflowService.getTask).mockResolvedValue(mockTasks[0])
      vi.mocked(workflowService.getTaskComments).mockResolvedValue({ comments: [], total: 0 })
      vi.mocked(workflowService.getTaskHistory).mockResolvedValue({ history: [], total: 0 })
      
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByText('Review Purchase Agreement')).toBeInTheDocument()
      })

      const taskTitle = screen.getByText('Review Purchase Agreement')
      await user.click(taskTitle)

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /task details/i })).toBeInTheDocument()
      })

      expect(screen.getByText('Review and approve purchase agreement with Vendor ABC')).toBeInTheDocument()
      expect(screen.getByText('Contract Review Process')).toBeInTheDocument()
      expect(screen.getByText('Dec 20, 2024')).toBeInTheDocument()
    })

    it('displays task comments in details panel', async () => {
      const user = userEvent.setup()
      vi.mocked(workflowService.getTask).mockResolvedValue(mockTasks[1])
      vi.mocked(workflowService.getTaskComments).mockResolvedValue({ 
        comments: mockTasks[1].comments, 
        total: 1 
      })
      vi.mocked(workflowService.getTaskHistory).mockResolvedValue({ history: [], total: 0 })
      
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByText('NDA Approval')).toBeInTheDocument()
      })

      const taskTitle = screen.getByText('NDA Approval')
      await user.click(taskTitle)

      await waitFor(() => {
        expect(screen.getByText('Started review process')).toBeInTheDocument()
      })
    })

    it('allows adding new comment to task', async () => {
      const user = userEvent.setup()
      vi.mocked(workflowService.getTask).mockResolvedValue(mockTasks[0])
      vi.mocked(workflowService.getTaskComments).mockResolvedValue({ comments: [], total: 0 })
      vi.mocked(workflowService.getTaskHistory).mockResolvedValue({ history: [], total: 0 })
      vi.mocked(workflowService.addComment).mockResolvedValue({
        id: '2',
        content: 'New comment added',
        author: mockAssignees[0],
        created_at: '2024-12-17T10:00:00Z',
      })
      
      renderWithProviders(<WorkflowTasksPage />)

      const taskTitle = screen.getByText('Review Purchase Agreement')
      await user.click(taskTitle)

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /add comment/i })).toBeInTheDocument()
      })

      const commentInput = screen.getByRole('textbox', { name: /add comment/i })
      await user.type(commentInput, 'New comment added')

      const addButton = screen.getByRole('button', { name: /add comment/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(workflowService.addComment).toHaveBeenCalledWith('1', {
          content: 'New comment added',
          mentions: [],
          attachment_ids: [],
        })
      })
    })

    it('displays task timeline with action history', async () => {
      const user = userEvent.setup()
      const mockHistory = [
        {
          id: '1',
          action: 'Created',
          details: 'Task created',
          performed_by: mockAssignees[1],
          timestamp: '2024-12-15T10:00:00Z',
        },
        {
          id: '2',
          action: 'Assigned',
          details: 'Assigned to John Doe',
          performed_by: mockAssignees[1],
          timestamp: '2024-12-15T10:05:00Z',
        },
      ]

      vi.mocked(workflowService.getTask).mockResolvedValue(mockTasks[0])
      vi.mocked(workflowService.getTaskComments).mockResolvedValue({ comments: [], total: 0 })
      vi.mocked(workflowService.getTaskHistory).mockResolvedValue({ 
        history: mockHistory, 
        total: 2 
      })
      
      renderWithProviders(<WorkflowTasksPage />)

      const taskTitle = screen.getByText('Review Purchase Agreement')
      await user.click(taskTitle)

      const timelineTab = screen.getByRole('tab', { name: /timeline/i })
      await user.click(timelineTab)

      await waitFor(() => {
        expect(screen.getByText('Task created')).toBeInTheDocument()
        expect(screen.getByText('Assigned to John Doe')).toBeInTheDocument()
      })
    })
  })

  describe('Bulk Operations', () => {
    it('enables bulk selection mode when checkbox is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /select all tasks/i })).toBeInTheDocument()
      })

      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all tasks/i })
      await user.click(selectAllCheckbox)

      expect(screen.getByRole('toolbar', { name: /bulk operations/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /bulk reassign/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /bulk complete/i })).toBeInTheDocument()
    })

    it('selects individual tasks for bulk operations', async () => {
      const user = userEvent.setup()
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox')
        expect(checkboxes.length).toBeGreaterThan(1) // At least select-all plus task checkboxes
      })

      const taskCheckboxes = screen.getAllByRole('checkbox').slice(1) // Skip select-all
      await user.click(taskCheckboxes[0])
      await user.click(taskCheckboxes[1])

      expect(screen.getByRole('toolbar', { name: /bulk operations/i })).toBeInTheDocument()
      expect(screen.getByText(/2 tasks selected/i)).toBeInTheDocument()
    })

    it('performs bulk reassignment of selected tasks', async () => {
      const user = userEvent.setup()
      vi.mocked(workflowService.bulkUpdateTasks).mockResolvedValue([])
      
      renderWithProviders(<WorkflowTasksPage />)

      // Select tasks
      const taskCheckboxes = screen.getAllByRole('checkbox').slice(1)
      await user.click(taskCheckboxes[0])
      await user.click(taskCheckboxes[1])

      const bulkReassignButton = screen.getByRole('button', { name: /bulk reassign/i })
      await user.click(bulkReassignButton)

      const assigneeSelect = screen.getByLabelText(/select new assignee/i)
      await user.selectOptions(assigneeSelect, '2')

      const confirmButton = screen.getByRole('button', { name: /confirm bulk reassign/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(workflowService.bulkUpdateTasks).toHaveBeenCalledWith({
          task_ids: ['1', '2'],
          updates: { assignee_id: '2' }
        })
      })
    })

    it('performs bulk completion of selected tasks', async () => {
      const user = userEvent.setup()
      vi.mocked(workflowService.bulkUpdateTasks).mockResolvedValue([])
      
      renderWithProviders(<WorkflowTasksPage />)

      // Select tasks
      const taskCheckboxes = screen.getAllByRole('checkbox').slice(1)
      await user.click(taskCheckboxes[0])

      const bulkCompleteButton = screen.getByRole('button', { name: /bulk complete/i })
      await user.click(bulkCompleteButton)

      const confirmButton = screen.getByRole('button', { name: /confirm bulk complete/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(workflowService.bulkUpdateTasks).toHaveBeenCalledWith({
          task_ids: ['1'],
          updates: { status: 'Completed' }
        })
      })
    })
  })

  describe('View Modes', () => {
    it('switches to kanban view mode', async () => {
      const user = userEvent.setup()
      renderWithProviders(<WorkflowTasksPage />)

      const kanbanViewButton = screen.getByRole('button', { name: /kanban view/i })
      await user.click(kanbanViewButton)

      expect(screen.getByRole('region', { name: /kanban board/i })).toBeInTheDocument()
      expect(screen.getByText('Pending')).toBeInTheDocument()
      expect(screen.getByText('In Progress')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    it('displays tasks in kanban columns', async () => {
      const user = userEvent.setup()
      renderWithProviders(<WorkflowTasksPage />)

      const kanbanViewButton = screen.getByRole('button', { name: /kanban view/i })
      await user.click(kanbanViewButton)

      await waitFor(() => {
        const pendingColumn = screen.getByRole('region', { name: /pending column/i })
        const inProgressColumn = screen.getByRole('region', { name: /in progress column/i })
        const overdueColumn = screen.getByRole('region', { name: /overdue column/i })

        expect(within(pendingColumn).getByText('Review Purchase Agreement')).toBeInTheDocument()
        expect(within(inProgressColumn).getByText('NDA Approval')).toBeInTheDocument()
        expect(within(overdueColumn).getByText('Risk Assessment Report')).toBeInTheDocument()
      })
    })

    it('switches to calendar view mode', async () => {
      const user = userEvent.setup()
      vi.mocked(workflowService.getCalendarEvents).mockResolvedValue([
        {
          id: '1',
          title: 'Review Purchase Agreement',
          start: '2024-12-20T09:00:00Z',
          status: 'Pending',
          priority: 'High',
          assignee: 'John Doe',
          workflow_type: 'Contract Review',
        },
      ])
      
      renderWithProviders(<WorkflowTasksPage />)

      const calendarViewButton = screen.getByRole('button', { name: /calendar view/i })
      await user.click(calendarViewButton)

      expect(screen.getByRole('grid', { name: /calendar/i })).toBeInTheDocument()
    })
  })

  describe('Export Functionality', () => {
    it('opens export dialog when export button is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<WorkflowTasksPage />)

      const exportButton = screen.getByRole('button', { name: /export tasks/i })
      await user.click(exportButton)

      expect(screen.getByRole('dialog', { name: /export tasks/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/export format/i)).toBeInTheDocument()
    })

    it('exports tasks to CSV format', async () => {
      const user = userEvent.setup()
      const mockBlob = new Blob(['csv content'], { type: 'text/csv' })
      vi.mocked(workflowService.exportTasks).mockResolvedValue(mockBlob)
      
      // Mock URL.createObjectURL
      const mockUrl = 'blob:mock-url'
      global.URL.createObjectURL = vi.fn(() => mockUrl)
      global.URL.revokeObjectURL = vi.fn()

      renderWithProviders(<WorkflowTasksPage />)

      const exportButton = screen.getByRole('button', { name: /export tasks/i })
      await user.click(exportButton)

      const formatSelect = screen.getByLabelText(/export format/i)
      await user.selectOptions(formatSelect, 'csv')

      const downloadButton = screen.getByRole('button', { name: /download/i })
      await user.click(downloadButton)

      await waitFor(() => {
        expect(workflowService.exportTasks).toHaveBeenCalledWith({
          format: 'csv',
          filters: {},
          fields: expect.any(Array),
          include_comments: false,
          include_attachments: false,
          include_history: false,
        })
      })
    })

    it('exports tasks to Excel format with comments and attachments', async () => {
      const user = userEvent.setup()
      const mockBlob = new Blob(['excel content'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      vi.mocked(workflowService.exportTasks).mockResolvedValue(mockBlob)
      
      renderWithProviders(<WorkflowTasksPage />)

      const exportButton = screen.getByRole('button', { name: /export tasks/i })
      await user.click(exportButton)

      const formatSelect = screen.getByLabelText(/export format/i)
      await user.selectOptions(formatSelect, 'excel')

      const includeCommentsCheckbox = screen.getByLabelText(/include comments/i)
      const includeAttachmentsCheckbox = screen.getByLabelText(/include attachments/i)
      await user.click(includeCommentsCheckbox)
      await user.click(includeAttachmentsCheckbox)

      const downloadButton = screen.getByRole('button', { name: /download/i })
      await user.click(downloadButton)

      await waitFor(() => {
        expect(workflowService.exportTasks).toHaveBeenCalledWith({
          format: 'excel',
          filters: {},
          fields: expect.any(Array),
          include_comments: true,
          include_attachments: true,
          include_history: false,
        })
      })
    })
  })

  describe('Error Handling', () => {
    it('displays error message when task loading fails', async () => {
      vi.mocked(workflowService.getTasks).mockRejectedValue(new Error('Failed to load tasks'))
      
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(screen.getByText(/failed to load tasks/i)).toBeInTheDocument()
      })
    })

    it('displays error message when task action fails', async () => {
      const user = userEvent.setup()
      vi.mocked(workflowService.startTask).mockRejectedValue(new Error('Failed to start task'))
      
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /start task/i })).toBeInTheDocument()
      })

      const startButton = screen.getByRole('button', { name: /start task/i })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(screen.getByText(/failed to start task/i)).toBeInTheDocument()
      })
    })

    it('handles network errors gracefully', async () => {
      vi.mocked(workflowService.getTasks).mockRejectedValue(new Error('Network error'))
      
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })
  })

  describe('Pagination', () => {
    it('displays pagination controls when there are multiple pages', async () => {
      vi.mocked(workflowService.getTasks).mockResolvedValue({
        tasks: mockTasks,
        total: 50,
        page: 1,
        per_page: 20,
        total_pages: 3,
        stats: mockStats,
      })
      
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument()
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument()
    })

    it('navigates to next page when next button is clicked', async () => {
      const user = userEvent.setup()
      vi.mocked(workflowService.getTasks).mockResolvedValue({
        tasks: mockTasks,
        total: 50,
        page: 1,
        per_page: 20,
        total_pages: 3,
        stats: mockStats,
      })
      
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument()
      })

      const nextButton = screen.getByRole('button', { name: /next page/i })
      await user.click(nextButton)

      await waitFor(() => {
        expect(workflowService.getTasks).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          2,
          20
        )
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', async () => {
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Workflow tasks')
        expect(screen.getByRole('navigation', { name: /task filters/i })).toBeInTheDocument()
        expect(screen.getByRole('region', { name: /task list/i })).toBeInTheDocument()
      })
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /start task/i })).toBeInTheDocument()
      })

      const startButton = screen.getByRole('button', { name: /start task/i })
      startButton.focus()
      
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(workflowService.startTask).toHaveBeenCalled()
      })
    })

    it('announces status changes to screen readers', async () => {
      const user = userEvent.setup()
      vi.mocked(workflowService.startTask).mockResolvedValue({ ...mockTasks[0], status: 'In Progress' })
      
      renderWithProviders(<WorkflowTasksPage />)

      const startButton = screen.getByRole('button', { name: /start task/i })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/task started successfully/i)
      })
    })
  })

  describe('Performance', () => {
    it('debounces search input to avoid excessive API calls', async () => {
      const user = userEvent.setup()
      vi.useFakeTimers()
      
      renderWithProviders(<WorkflowTasksPage />)

      const searchInput = screen.getByPlaceholderText(/search tasks/i)
      await user.type(searchInput, 'search term')

      // Fast typing shouldn't trigger multiple calls immediately
      expect(workflowService.getTasks).toHaveBeenCalledTimes(1) // Initial load

      // Advance timers to trigger debounced search
      vi.advanceTimersByTime(500)

      await waitFor(() => {
        expect(workflowService.getTasks).toHaveBeenCalledWith(
          expect.objectContaining({
            search_query: 'search term'
          }),
          expect.any(Object),
          1,
          20
        )
      })

      vi.useRealTimers()
    })

    it('implements virtual scrolling for large task lists', async () => {
      const largeMockTasks = Array.from({ length: 1000 }, (_, i) => ({
        ...mockTasks[0],
        id: `task-${i}`,
        title: `Task ${i}`,
      }))

      vi.mocked(workflowService.getTasks).mockResolvedValue({
        tasks: largeMockTasks,
        total: 1000,
        page: 1,
        per_page: 1000,
        total_pages: 1,
        stats: mockStats,
      })
      
      renderWithProviders(<WorkflowTasksPage />)

      await waitFor(() => {
        // Should only render visible items, not all 1000
        const renderedTasks = screen.getAllByRole('row').filter(row => 
          row.getAttribute('data-task-id')
        )
        expect(renderedTasks.length).toBeLessThan(100) // Virtual scrolling active
      })
    })
  })
})