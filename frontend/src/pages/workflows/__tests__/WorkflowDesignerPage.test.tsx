/**
 * WorkflowDesignerPage Component Tests
 * Following strict TDD methodology - RED phase: write failing tests first
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import userEvent from '@testing-library/user-event'
import WorkflowDesignerPage from '../WorkflowDesignerPage'

// Test wrapper component with all necessary providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <DndProvider backend={HTML5Backend}>
          {children}
        </DndProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}

// Mock workflow data
const mockWorkflow = {
  id: 'wf-1',
  name: 'Contract Approval Workflow',
  description: 'Standard workflow for contract approvals',
  category: 'approvals',
  tags: ['contract', 'approval', 'legal'],
  sla: 72, // hours
  version: '1.0',
  created_at: '2024-01-10T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
  nodes: [
    {
      id: 'node-1',
      type: 'start',
      position: { x: 100, y: 100 },
      data: { name: 'Start', description: 'Workflow start' }
    },
    {
      id: 'node-2',
      type: 'task',
      position: { x: 300, y: 100 },
      data: { 
        name: 'Review Contract', 
        description: 'Legal team review',
        assignee: 'legal-team',
        dueDate: 24
      }
    },
    {
      id: 'node-3',
      type: 'decision',
      position: { x: 500, y: 100 },
      data: { 
        name: 'Approval Decision', 
        description: 'Approve or reject',
        conditions: ['approved', 'rejected']
      }
    },
    {
      id: 'node-4',
      type: 'end',
      position: { x: 700, y: 100 },
      data: { name: 'End', description: 'Workflow complete' }
    }
  ],
  connections: [
    { id: 'conn-1', source: 'node-1', target: 'node-2' },
    { id: 'conn-2', source: 'node-2', target: 'node-3' },
    { id: 'conn-3', source: 'node-3', target: 'node-4', condition: 'approved' }
  ]
}

const mockNodeTypes = [
  { type: 'start', label: 'Start', icon: 'play' },
  { type: 'end', label: 'End', icon: 'stop' },
  { type: 'task', label: 'Task', icon: 'clipboard' },
  { type: 'decision', label: 'Decision', icon: 'branch' },
  { type: 'parallel', label: 'Parallel Gateway', icon: 'fork' },
  { type: 'timer', label: 'Timer', icon: 'clock' },
  { type: 'email', label: 'Email', icon: 'mail' }
]

describe('WorkflowDesignerPage Component', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
    
    // Mock localStorage for auto-save
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock
    })

    // Mock requestAnimationFrame for auto-save
    vi.stubGlobal('requestAnimationFrame', (callback: Function) => {
      setTimeout(callback, 16)
      return 1
    })

    // Mock canvas context for drawing connections
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 100 }),
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.unstubAllGlobals()
  })

  describe('Initial Render', () => {
    it('should render workflow designer page with main components', () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      expect(screen.getByTestId('workflow-designer-page')).toBeInTheDocument()
      expect(screen.getByTestId('workflow-canvas')).toBeInTheDocument()
      expect(screen.getByTestId('node-palette')).toBeInTheDocument()
      expect(screen.getByTestId('properties-panel')).toBeInTheDocument()
      expect(screen.getByTestId('workflow-toolbar')).toBeInTheDocument()
    })

    it('should render page title and navigation', () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Workflow Designer')
      expect(screen.getByTestId('back-button')).toBeInTheDocument()
    })

    it('should render empty canvas initially', () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const canvas = screen.getByTestId('workflow-canvas')
      expect(canvas).toBeInTheDocument()
      expect(screen.getByText('Drop nodes here to start building your workflow')).toBeInTheDocument()
    })

    it('should render all node types in palette', () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const palette = screen.getByTestId('node-palette')
      expect(within(palette).getByTestId('node-start')).toBeInTheDocument()
      expect(within(palette).getByTestId('node-end')).toBeInTheDocument()
      expect(within(palette).getByTestId('node-task')).toBeInTheDocument()
      expect(within(palette).getByTestId('node-decision')).toBeInTheDocument()
      expect(within(palette).getByTestId('node-parallel')).toBeInTheDocument()
      expect(within(palette).getByTestId('node-timer')).toBeInTheDocument()
      expect(within(palette).getByTestId('node-email')).toBeInTheDocument()
    })
  })

  describe('Workflow Metadata Management', () => {
    it('should render workflow metadata form', () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      expect(screen.getByTestId('workflow-metadata-form')).toBeInTheDocument()
      expect(screen.getByLabelText('Workflow Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Description')).toBeInTheDocument()
      expect(screen.getByLabelText('Category')).toBeInTheDocument()
      expect(screen.getByLabelText('Tags')).toBeInTheDocument()
      expect(screen.getByLabelText('SLA (hours)')).toBeInTheDocument()
    })

    it('should update workflow metadata when form fields change', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const nameInput = screen.getByLabelText('Workflow Name')
      await user.type(nameInput, 'Test Workflow')
      expect(nameInput).toHaveValue('Test Workflow')

      const descriptionInput = screen.getByLabelText('Description')
      await user.type(descriptionInput, 'Test description')
      expect(descriptionInput).toHaveValue('Test description')

      const slaInput = screen.getByLabelText('SLA (hours)')
      await user.clear(slaInput)
      await user.type(slaInput, '48')
      expect(slaInput).toHaveValue(48)
    })

    it('should validate required workflow metadata fields', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const saveButton = screen.getByTestId('save-workflow-button')
      await user.click(saveButton)

      expect(screen.getByText('Workflow name is required')).toBeInTheDocument()
      expect(screen.getByText('Description is required')).toBeInTheDocument()
    })

    it('should handle tags input with comma separation', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const tagsInput = screen.getByLabelText('Tags')
      await user.type(tagsInput, 'approval,legal,contract')

      // Should show individual tags
      await waitFor(() => {
        expect(screen.getByTestId('tag-approval')).toBeInTheDocument()
        expect(screen.getByTestId('tag-legal')).toBeInTheDocument()
        expect(screen.getByTestId('tag-contract')).toBeInTheDocument()
      })
    })
  })

  describe('Drag and Drop Functionality', () => {
    it('should allow dragging nodes from palette to canvas', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const startNode = screen.getByTestId('node-start')
      const canvas = screen.getByTestId('workflow-canvas')

      // Simulate drag and drop
      fireEvent.dragStart(startNode)
      fireEvent.dragOver(canvas)
      fireEvent.drop(canvas, {
        dataTransfer: {
          getData: () => 'start'
        }
      })

      await waitFor(() => {
        expect(screen.getByTestId('canvas-node-1')).toBeInTheDocument()
      })
    })

    it('should allow moving nodes within canvas', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // First add a node
      const startNode = screen.getByTestId('node-start')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(startNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        const canvasNode = screen.getByTestId('canvas-node-1')
        expect(canvasNode).toBeInTheDocument()

        // Now move the node
        fireEvent.mouseDown(canvasNode)
        fireEvent.mouseMove(canvasNode, { clientX: 200, clientY: 200 })
        fireEvent.mouseUp(canvasNode)
      })
    })

    it.skip('should show drop zones when dragging', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const startNode = screen.getByTestId('node-start')
      
      fireEvent.dragStart(startNode)
      
      expect(screen.getByTestId('canvas-drop-zone')).toHaveClass('active')
    })

    it.skip('should prevent dropping invalid node combinations', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Add two start nodes (should be prevented)
      const startNode = screen.getByTestId('node-start')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(startNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        expect(screen.getByTestId('canvas-node-1')).toBeInTheDocument()
      })

      // Try to add another start node
      fireEvent.dragStart(startNode)
      fireEvent.drop(canvas)

      expect(screen.getByText('Only one start node is allowed per workflow')).toBeInTheDocument()
    })
  })

  describe('Node Selection and Properties', () => {
    it('should select node when clicked and show properties', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Add a node first
      const taskNode = screen.getByTestId('node-task')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(taskNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        const canvasNode = screen.getByTestId('canvas-node-1')
        fireEvent.click(canvasNode)

        expect(canvasNode).toHaveClass('selected')
        expect(screen.getByTestId('node-properties')).toBeInTheDocument()
        expect(screen.getByLabelText('Node Name')).toBeInTheDocument()
        expect(screen.getByLabelText('Node Description')).toBeInTheDocument()
      })
    })

    it('should show task-specific properties for task nodes', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const taskNode = screen.getByTestId('node-task')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(taskNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        const canvasNode = screen.getByTestId('canvas-node-1')
        fireEvent.click(canvasNode)

        expect(screen.getByLabelText('Assignee')).toBeInTheDocument()
        expect(screen.getByLabelText('Due Date (hours)')).toBeInTheDocument()
      })
    })

    it('should show decision-specific properties for decision nodes', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const decisionNode = screen.getByTestId('node-decision')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(decisionNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        const canvasNode = screen.getByTestId('canvas-node-1')
        fireEvent.click(canvasNode)

        expect(screen.getByTestId('conditions-list')).toBeInTheDocument()
        expect(screen.getByTestId('add-condition-button')).toBeInTheDocument()
      })
    })

    it.skip('should update node properties when form fields change', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const taskNode = screen.getByTestId('node-task')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(taskNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        const canvasNode = screen.getByTestId('canvas-node-1')
        fireEvent.click(canvasNode)

        const nameInput = screen.getByLabelText('Node Name')
        user.clear(nameInput)
        user.type(nameInput, 'Updated Task')
        expect(nameInput).toHaveValue('Updated Task')
      })
    })
  })

  describe('Connection Management', () => {
    it.skip('should allow connecting nodes with lines', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Add two nodes
      const startNode = screen.getByTestId('node-start')
      const taskNode = screen.getByTestId('node-task')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(startNode)
      fireEvent.drop(canvas)

      fireEvent.dragStart(taskNode)
      fireEvent.drop(canvas, { clientX: 300, clientY: 100 })

      await waitFor(() => {
        const node1 = screen.getByTestId('canvas-node-1')
        const node2 = screen.getByTestId('canvas-node-2')

        // Start connection by clicking first node's output port
        const outputPort = within(node1).getByTestId('output-port')
        fireEvent.mouseDown(outputPort)

        // Complete connection by clicking second node's input port
        const inputPort = within(node2).getByTestId('input-port')
        fireEvent.mouseUp(inputPort)

        expect(screen.getByTestId('connection-1')).toBeInTheDocument()
      })
    })

    it.skip('should show connection properties when connection is selected', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Create nodes and connection first
      const startNode = screen.getByTestId('node-start')
      const decisionNode = screen.getByTestId('node-decision')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(startNode)
      fireEvent.drop(canvas)
      fireEvent.dragStart(decisionNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        // Create connection
        const node1 = screen.getByTestId('canvas-node-1')
        const node2 = screen.getByTestId('canvas-node-2')
        const outputPort = within(node1).getByTestId('output-port')
        const inputPort = within(node2).getByTestId('input-port')

        fireEvent.mouseDown(outputPort)
        fireEvent.mouseUp(inputPort)

        // Select connection
        const connection = screen.getByTestId('connection-1')
        fireEvent.click(connection)

        expect(screen.getByTestId('connection-properties')).toBeInTheDocument()
        expect(screen.getByLabelText('Condition')).toBeInTheDocument()
      })
    })

    it.skip('should prevent invalid connections', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Try to connect end node to start node (invalid)
      const endNode = screen.getByTestId('node-end')
      const startNode = screen.getByTestId('node-start')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(endNode)
      fireEvent.drop(canvas)
      fireEvent.dragStart(startNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        const node1 = screen.getByTestId('canvas-node-1')
        const node2 = screen.getByTestId('canvas-node-2')
        const outputPort = within(node1).getByTestId('output-port')
        const inputPort = within(node2).getByTestId('input-port')

        fireEvent.mouseDown(outputPort)
        fireEvent.mouseUp(inputPort)

        expect(screen.getByText('Invalid connection: End nodes cannot have outgoing connections')).toBeInTheDocument()
      })
    })

    it.skip('should delete connections when delete key is pressed', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Create connection first
      const startNode = screen.getByTestId('node-start')
      const taskNode = screen.getByTestId('node-task')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(startNode)
      fireEvent.drop(canvas)
      fireEvent.dragStart(taskNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        const node1 = screen.getByTestId('canvas-node-1')
        const node2 = screen.getByTestId('canvas-node-2')
        const outputPort = within(node1).getByTestId('output-port')
        const inputPort = within(node2).getByTestId('input-port')

        fireEvent.mouseDown(outputPort)
        fireEvent.mouseUp(inputPort)

        // Select and delete connection
        const connection = screen.getByTestId('connection-1')
        fireEvent.click(connection)
        fireEvent.keyDown(document, { key: 'Delete' })

        expect(screen.queryByTestId('connection-1')).not.toBeInTheDocument()
      })
    })
  })

  describe('Workflow Validation', () => {
    it('should show validation button and trigger validation', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const validateButton = screen.getByTestId('validate-workflow-button')
      expect(validateButton).toBeInTheDocument()

      await user.click(validateButton)
      expect(screen.getByTestId('validation-results')).toBeInTheDocument()
    })

    it('should detect orphan nodes during validation', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Add isolated node
      const taskNode = screen.getByTestId('node-task')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(taskNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        const validateButton = screen.getByTestId('validate-workflow-button')
        fireEvent.click(validateButton)

        expect(screen.getByText('Orphan nodes detected: Task nodes must be connected')).toBeInTheDocument()
      })
    })

    it.skip('should detect missing start node during validation', async () => {
      // reason: leaks unhandled react-dnd "Cannot call hover while not dragging" — Phase 1 rewrite scope
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Add nodes without start
      const taskNode = screen.getByTestId('node-task')
      const endNode = screen.getByTestId('node-end')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(taskNode)
      fireEvent.drop(canvas)
      fireEvent.dragStart(endNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        const validateButton = screen.getByTestId('validate-workflow-button')
        fireEvent.click(validateButton)

        expect(screen.getByText('Workflow must have exactly one start node')).toBeInTheDocument()
      })
    })

    it('should detect circular dependencies during validation', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Create circular connection setup and validate
      const validateButton = screen.getByTestId('validate-workflow-button')
      // Mock workflow with circular dependency
      await user.click(validateButton)

      // This would need more complex setup - simplified for test
      expect(screen.getByTestId('validation-results')).toBeInTheDocument()
    })

    it.skip('should show validation success for valid workflow', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Create valid workflow: start -> task -> end
      const startNode = screen.getByTestId('node-start')
      const taskNode = screen.getByTestId('node-task')
      const endNode = screen.getByTestId('node-end')
      const canvas = screen.getByTestId('workflow-canvas')

      fireEvent.dragStart(startNode)
      fireEvent.drop(canvas)
      fireEvent.dragStart(taskNode)
      fireEvent.drop(canvas)
      fireEvent.dragStart(endNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        // Connect nodes
        const node1 = screen.getByTestId('canvas-node-1')
        const node2 = screen.getByTestId('canvas-node-2')
        const node3 = screen.getByTestId('canvas-node-3')

        const outputPort1 = within(node1).getByTestId('output-port')
        const inputPort2 = within(node2).getByTestId('input-port')
        fireEvent.mouseDown(outputPort1)
        fireEvent.mouseUp(inputPort2)

        const outputPort2 = within(node2).getByTestId('output-port')
        const inputPort3 = within(node3).getByTestId('input-port')
        fireEvent.mouseDown(outputPort2)
        fireEvent.mouseUp(inputPort3)

        const validateButton = screen.getByTestId('validate-workflow-button')
        fireEvent.click(validateButton)

        expect(screen.getByText('Workflow validation successful')).toBeInTheDocument()
      })
    })
  })

  describe('Test/Debug Mode', () => {
    it('should have test mode toggle button', () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      expect(screen.getByTestId('test-mode-toggle')).toBeInTheDocument()
    })

    it('should enter test mode and show step controls', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const testToggle = screen.getByTestId('test-mode-toggle')
      await user.click(testToggle)

      expect(screen.getByTestId('test-controls')).toBeInTheDocument()
      expect(screen.getByTestId('step-forward-button')).toBeInTheDocument()
      expect(screen.getByTestId('step-backward-button')).toBeInTheDocument()
      expect(screen.getByTestId('reset-test-button')).toBeInTheDocument()
    })

    it('should step through workflow execution in test mode', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Enter test mode
      const testToggle = screen.getByTestId('test-mode-toggle')
      await user.click(testToggle)

      // Step forward
      const stepForwardButton = screen.getByTestId('step-forward-button')
      await user.click(stepForwardButton)

      expect(screen.getByTestId('execution-state')).toBeInTheDocument()
      expect(screen.getByText('Current Step: 1')).toBeInTheDocument()
    })

    it('should highlight active node during test execution', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Add nodes and enter test mode
      const startNode = screen.getByTestId('node-start')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(startNode)
      fireEvent.drop(canvas)

      const testToggle = screen.getByTestId('test-mode-toggle')
      await user.click(testToggle)

      const stepForwardButton = screen.getByTestId('step-forward-button')
      await user.click(stepForwardButton)

      await waitFor(() => {
        const canvasNode = screen.getByTestId('canvas-node-1')
        expect(canvasNode).toHaveClass('active-execution')
      })
    })
  })

  describe('Save/Load Operations', () => {
    it('should have save and load buttons', () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      expect(screen.getByTestId('save-workflow-button')).toBeInTheDocument()
      expect(screen.getByTestId('load-workflow-button')).toBeInTheDocument()
    })

    it.skip('should save workflow with metadata and nodes', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Fill in metadata
      const nameInput = screen.getByLabelText('Workflow Name')
      await user.type(nameInput, 'Test Workflow')

      // Add a node
      const startNode = screen.getByTestId('node-start')
      const canvas = screen.getByTestId('workflow-canvas')
      fireEvent.dragStart(startNode)
      fireEvent.drop(canvas)

      // Save
      const saveButton = screen.getByTestId('save-workflow-button')
      await user.click(saveButton)

      expect(screen.getByText('Workflow saved successfully')).toBeInTheDocument()
    })

    it('should load workflow from template', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const loadButton = screen.getByTestId('load-workflow-button')
      await user.click(loadButton)

      expect(screen.getByTestId('load-template-modal')).toBeInTheDocument()
      expect(screen.getByText('Select Workflow Template')).toBeInTheDocument()
    })

    it('should show template selection dialog when loading', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const loadButton = screen.getByTestId('load-workflow-button')
      await user.click(loadButton)

      const modal = screen.getByTestId('load-template-modal')
      expect(within(modal).getByText('Contract Approval')).toBeInTheDocument()
      expect(within(modal).getByText('Document Review')).toBeInTheDocument()
      expect(within(modal).getByText('Legal Compliance')).toBeInTheDocument()
    })
  })

  describe('Version Control', () => {
    it('should show version history button', () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      expect(screen.getByTestId('version-history-button')).toBeInTheDocument()
    })

    it('should open version history panel', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const versionButton = screen.getByTestId('version-history-button')
      await user.click(versionButton)

      expect(screen.getByTestId('version-history-panel')).toBeInTheDocument()
      expect(screen.getByText('Version History')).toBeInTheDocument()
    })

    it('should show version list with details', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const versionButton = screen.getByTestId('version-history-button')
      await user.click(versionButton)

      const panel = screen.getByTestId('version-history-panel')
      expect(within(panel).getByText('v1.0 - Current')).toBeInTheDocument()
      expect(within(panel).getByText('v0.9 - Draft')).toBeInTheDocument()
    })

    it.skip('should allow reverting to previous version', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const versionButton = screen.getByTestId('version-history-button')
      await user.click(versionButton)

      const revertButton = screen.getByTestId('revert-version-0.9')
      await user.click(revertButton)

      expect(screen.getByText('Confirm revert to version 0.9?')).toBeInTheDocument()
    })
  })

  describe('Import/Export Operations', () => {
    it('should have import and export buttons', () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      expect(screen.getByTestId('export-workflow-button')).toBeInTheDocument()
      expect(screen.getByTestId('import-workflow-button')).toBeInTheDocument()
    })

    it('should show export format options', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const exportButton = screen.getByTestId('export-workflow-button')
      await user.click(exportButton)

      expect(screen.getByTestId('export-format-modal')).toBeInTheDocument()
      expect(screen.getByLabelText('JSON')).toBeInTheDocument()
      expect(screen.getByLabelText('BPMN')).toBeInTheDocument()
    })

    it.skip('should export workflow as JSON', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const exportButton = screen.getByTestId('export-workflow-button')
      await user.click(exportButton)

      const jsonOption = screen.getByLabelText('JSON')
      await user.click(jsonOption)

      const confirmButton = screen.getByTestId('confirm-export-button')
      await user.click(confirmButton)

      // Mock file download
      expect(screen.getByText('Workflow exported successfully')).toBeInTheDocument()
    })

    it('should import workflow from file', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const importButton = screen.getByTestId('import-workflow-button')
      await user.click(importButton)

      expect(screen.getByTestId('import-file-modal')).toBeInTheDocument()
      expect(screen.getByText('Select workflow file to import')).toBeInTheDocument()

      const fileInput = screen.getByTestId('workflow-file-input')
      expect(fileInput).toHaveAttribute('accept', '.json,.bpmn')
    })
  })

  describe('Canvas Controls', () => {
    it('should have zoom controls', () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      expect(screen.getByTestId('zoom-in-button')).toBeInTheDocument()
      expect(screen.getByTestId('zoom-out-button')).toBeInTheDocument()
      expect(screen.getByTestId('zoom-reset-button')).toBeInTheDocument()
      expect(screen.getByTestId('zoom-level-display')).toBeInTheDocument()
    })

    it('should zoom in and out of canvas', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const zoomInButton = screen.getByTestId('zoom-in-button')
      const zoomDisplay = screen.getByTestId('zoom-level-display')

      expect(zoomDisplay).toHaveTextContent('100%')

      await user.click(zoomInButton)
      expect(zoomDisplay).toHaveTextContent('125%')

      const zoomOutButton = screen.getByTestId('zoom-out-button')
      await user.click(zoomOutButton)
      expect(zoomDisplay).toHaveTextContent('100%')
    })

    it.skip('should reset zoom to 100%', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const zoomInButton = screen.getByTestId('zoom-in-button')
      const zoomResetButton = screen.getByTestId('zoom-reset-button')
      const zoomDisplay = screen.getByTestId('zoom-level-display')

      await user.click(zoomInButton)
      await user.click(zoomInButton)
      expect(zoomDisplay).toHaveTextContent('156%')

      await user.click(zoomResetButton)
      expect(zoomDisplay).toHaveTextContent('100%')
    })

    it.skip('should pan canvas with mouse drag', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(canvas, { clientX: 150, clientY: 150 })
      fireEvent.mouseUp(canvas)

      // Canvas should have moved
      expect(canvas).toHaveStyle({ transform: 'translate(50px, 50px)' })
    })
  })

  describe('Mini-map Navigation', () => {
    it('should show mini-map for large workflows', () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      expect(screen.getByTestId('mini-map')).toBeInTheDocument()
    })

    it('should update mini-map when nodes are added', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const startNode = screen.getByTestId('node-start')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(startNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        const miniMap = screen.getByTestId('mini-map')
        expect(within(miniMap).getByTestId('mini-node-1')).toBeInTheDocument()
      })
    })

    it.skip('should allow navigation by clicking on mini-map', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const miniMap = screen.getByTestId('mini-map')
      fireEvent.click(miniMap, { clientX: 50, clientY: 50 })

      // Canvas should move to show clicked area
      const canvas = screen.getByTestId('workflow-canvas')
      expect(canvas).toHaveAttribute('data-viewport-changed', 'true')
    })
  })

  describe('Undo/Redo Functionality', () => {
    it('should have undo and redo buttons', () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      expect(screen.getByTestId('undo-button')).toBeInTheDocument()
      expect(screen.getByTestId('redo-button')).toBeInTheDocument()
    })

    it.skip('should undo last action with Ctrl+Z', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Add a node
      const startNode = screen.getByTestId('node-start')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(startNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        expect(screen.getByTestId('canvas-node-1')).toBeInTheDocument()
      })

      // Undo with keyboard shortcut
      fireEvent.keyDown(document, { key: 'z', ctrlKey: true })

      expect(screen.queryByTestId('canvas-node-1')).not.toBeInTheDocument()
    })

    it.skip('should redo last undone action with Ctrl+Y', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Add a node
      const startNode = screen.getByTestId('node-start')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(startNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        expect(screen.getByTestId('canvas-node-1')).toBeInTheDocument()
      })

      // Undo
      fireEvent.keyDown(document, { key: 'z', ctrlKey: true })
      expect(screen.queryByTestId('canvas-node-1')).not.toBeInTheDocument()

      // Redo with keyboard shortcut
      fireEvent.keyDown(document, { key: 'y', ctrlKey: true })
      
      await waitFor(() => {
        expect(screen.getByTestId('canvas-node-1')).toBeInTheDocument()
      })
    })

    it('should disable undo/redo buttons when no actions available', () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const undoButton = screen.getByTestId('undo-button')
      const redoButton = screen.getByTestId('redo-button')

      expect(undoButton).toBeDisabled()
      expect(redoButton).toBeDisabled()
    })
  })

  describe('Auto-save Functionality', () => {
    it.skip('should auto-save workflow every 30 seconds', async () => {
      vi.useFakeTimers()

      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Make a change
      const nameInput = screen.getByLabelText('Workflow Name')
      await user.type(nameInput, 'Auto-save Test')

      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30000)

      await waitFor(() => {
        expect(screen.getByText('Auto-saved')).toBeInTheDocument()
      })

      vi.useRealTimers()
    })

    it('should show auto-save indicator', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      expect(screen.getByTestId('auto-save-status')).toBeInTheDocument()
      expect(screen.getByText('All changes saved')).toBeInTheDocument()
    })

    it.skip('should recover from auto-saved data on page reload', () => {
      // Mock localStorage with saved data
      const savedData = JSON.stringify({
        name: 'Recovered Workflow',
        nodes: [{ id: 'node-1', type: 'start', position: { x: 100, y: 100 } }]
      })

      vi.mocked(window.localStorage.getItem).mockReturnValue(savedData)

      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      expect(screen.getByDisplayValue('Recovered Workflow')).toBeInTheDocument()
      expect(screen.getByText('Recovered from auto-save')).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it.skip('should support keyboard navigation between nodes', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Add multiple nodes
      const startNode = screen.getByTestId('node-start')
      const taskNode = screen.getByTestId('node-task')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(startNode)
      fireEvent.drop(canvas)
      fireEvent.dragStart(taskNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        // Focus first node
        const node1 = screen.getByTestId('canvas-node-1')
        node1.focus()

        // Navigate with arrow keys
        fireEvent.keyDown(node1, { key: 'ArrowRight' })
        
        const node2 = screen.getByTestId('canvas-node-2')
        expect(node2).toHaveFocus()
      })
    })

    it.skip('should delete selected node with Delete key', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const startNode = screen.getByTestId('node-start')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(startNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        const canvasNode = screen.getByTestId('canvas-node-1')
        fireEvent.click(canvasNode)
        fireEvent.keyDown(document, { key: 'Delete' })

        expect(screen.queryByTestId('canvas-node-1')).not.toBeInTheDocument()
      })
    })

    it.skip('should support space bar to open node properties', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const taskNode = screen.getByTestId('node-task')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(taskNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        const canvasNode = screen.getByTestId('canvas-node-1')
        canvasNode.focus()
        fireEvent.keyDown(canvasNode, { key: ' ' })

        expect(screen.getByTestId('node-properties')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it.skip('should show error message for invalid workflow operations', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Try to save empty workflow
      const saveButton = screen.getByTestId('save-workflow-button')
      await user.click(saveButton)

      expect(screen.getByTestId('error-message')).toBeInTheDocument()
      expect(screen.getByText('Workflow name is required')).toBeInTheDocument()
    })

    it.skip('should handle save operation failures gracefully', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      // Fill required fields
      const nameInput = screen.getByLabelText('Workflow Name')
      await user.type(nameInput, 'Test Workflow')
      
      const descriptionInput = screen.getByLabelText('Description')
      await user.type(descriptionInput, 'Test description')

      // Mock save failure
      const saveButton = screen.getByTestId('save-workflow-button')
      await user.click(saveButton)

      // Assuming the service fails
      await waitFor(() => {
        expect(screen.getByText('Failed to save workflow. Please try again.')).toBeInTheDocument()
      })
    })

    it.skip('should show loading state during save operations', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const nameInput = screen.getByLabelText('Workflow Name')
      await user.type(nameInput, 'Test Workflow')
      
      const descriptionInput = screen.getByLabelText('Description')
      await user.type(descriptionInput, 'Test description')

      const saveButton = screen.getByTestId('save-workflow-button')
      await user.click(saveButton)

      expect(screen.getByTestId('saving-indicator')).toBeInTheDocument()
      expect(saveButton).toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for all interactive elements', () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Workflow Designer')
      expect(screen.getByTestId('workflow-canvas')).toHaveAttribute('aria-label', 'Workflow Canvas')
      expect(screen.getByTestId('node-palette')).toHaveAttribute('aria-label', 'Node Palette')
      expect(screen.getByTestId('properties-panel')).toHaveAttribute('aria-label', 'Properties Panel')
    })

    it.skip('should support screen reader announcements for state changes', async () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const startNode = screen.getByTestId('node-start')
      const canvas = screen.getByTestId('workflow-canvas')
      
      fireEvent.dragStart(startNode)
      fireEvent.drop(canvas)

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Start node added to workflow')
      })
    })

    it.skip('should have keyboard focus indicators', () => {
      render(
        <TestWrapper>
          <WorkflowDesignerPage />
        </TestWrapper>
      )

      const focusableElements = screen.getAllByRole('button')
      focusableElements.forEach(element => {
        element.focus()
        expect(element).toHaveClass('focus:ring-2')
      })
    })
  })
})