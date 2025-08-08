import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ClauseAssemblySystem } from '../ClauseAssemblySystem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// Mock dependencies
vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: 'user1',
      permissions: ['view_clauses', 'edit_clauses', 'approve_clauses'],
    },
  }),
}));

describe('ClauseAssemblySystem', () => {
  let queryClient: QueryClient;
  const mockOnSave = vi.fn();
  const mockOnPublish = vi.fn();

  const mockClauses = [
    {
      id: 'clause1',
      title: 'Payment Terms',
      content: 'Payment shall be due within 30 days of invoice date.',
      category: 'payment',
      riskLevel: 'medium',
      dependencies: [],
      conflicts: ['clause3'],
      alternatives: ['clause4'],
      usage: 150,
      lastUsed: '2024-01-15',
      rating: 4.2,
      version: '1.0',
      status: 'approved',
      reviewRequired: false,
      playbookCompliant: true,
      legalReviewTriggers: ['high_value'],
      position: 0,
    },
    {
      id: 'clause2',
      title: 'Termination',
      content: 'Either party may terminate this agreement with 30 days notice.',
      category: 'termination',
      riskLevel: 'high',
      dependencies: ['clause1'],
      conflicts: [],
      alternatives: ['clause5'],
      usage: 200,
      lastUsed: '2024-01-20',
      rating: 4.5,
      version: '2.1',
      status: 'approved',
      reviewRequired: true,
      playbookCompliant: true,
      legalReviewTriggers: ['termination_change'],
      position: 1,
    },
    {
      id: 'clause3',
      title: 'Immediate Payment',
      content: 'Payment is due immediately upon completion of services.',
      category: 'payment',
      riskLevel: 'low',
      dependencies: [],
      conflicts: ['clause1'],
      alternatives: [],
      usage: 50,
      lastUsed: '2024-01-10',
      rating: 3.8,
      version: '1.0',
      status: 'draft',
      reviewRequired: true,
      playbookCompliant: false,
      legalReviewTriggers: [],
      position: 2,
    },
  ];

  const mockAssembly = {
    id: 'assembly1',
    name: 'Service Agreement Assembly',
    clauses: mockClauses,
    version: '1.0',
    status: 'draft',
    conflicts: [
      {
        type: 'payment_conflict',
        clauseIds: ['clause1', 'clause3'],
        description: 'Conflicting payment terms',
        severity: 'high',
        suggestions: ['Remove one payment clause', 'Merge payment terms'],
      },
    ],
    analytics: {
      totalUsage: 400,
      averageRating: 4.17,
      completionRate: 0.85,
      reviewTime: '2.5 days',
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    const { api } = require('../../../services/api');
    api.get.mockImplementation((url) => {
      if (url.includes('/clauses')) {
        return Promise.resolve({ data: mockClauses });
      }
      if (url.includes('/assemblies')) {
        return Promise.resolve({ data: mockAssembly });
      }
      if (url.includes('/analytics')) {
        return Promise.resolve({ data: mockAssembly.analytics });
      }
      return Promise.resolve({ data: [] });
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <DndProvider backend={HTML5Backend}>
          <ClauseAssemblySystem
            onSave={mockOnSave}
            onPublish={mockOnPublish}
            {...props}
          />
        </DndProvider>
      </QueryClientProvider>
    );
  };

  describe('Initial Render', () => {
    it('should render the clause assembly system', () => {
      renderComponent();
      
      expect(screen.getByTestId('clause-assembly-system')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /clause assembly/i })).toBeInTheDocument();
    });

    it('should show clause library and assembly workspace', () => {
      renderComponent();
      
      expect(screen.getByTestId('clause-library')).toBeInTheDocument();
      expect(screen.getByTestId('assembly-workspace')).toBeInTheDocument();
    });

    it('should display clause categories', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Payment')).toBeInTheDocument();
        expect(screen.getByText('Termination')).toBeInTheDocument();
      });
    });

    it('should show assembly analytics', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/total usage: 400/i)).toBeInTheDocument();
        expect(screen.getByText(/average rating: 4.17/i)).toBeInTheDocument();
        expect(screen.getByText(/completion rate: 85%/i)).toBeInTheDocument();
      });
    });
  });

  describe('Drag-and-drop Clause Builder', () => {
    it('should allow dragging clauses from library to workspace', async () => {
      renderComponent();
      
      await waitFor(() => {
        const clause = screen.getByTestId('clause-item-clause1');
        const workspace = screen.getByTestId('assembly-workspace');
        
        fireEvent.dragStart(clause);
        fireEvent.dragEnter(workspace);
        fireEvent.dragOver(workspace);
        fireEvent.drop(workspace);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('assembled-clause-clause1')).toBeInTheDocument();
      });
    });

    it('should show drag preview while dragging', async () => {
      renderComponent();
      
      await waitFor(() => {
        const clause = screen.getByTestId('clause-item-clause1');
        fireEvent.dragStart(clause);
        
        expect(screen.getByTestId('drag-preview')).toBeInTheDocument();
        expect(screen.getByText('Payment Terms')).toBeInTheDocument();
      });
    });

    it('should allow reordering clauses in workspace', async () => {
      renderComponent({ initialClauses: mockClauses });
      
      await waitFor(() => {
        const clause1 = screen.getByTestId('assembled-clause-clause1');
        const clause2 = screen.getByTestId('assembled-clause-clause2');
        
        fireEvent.dragStart(clause1);
        fireEvent.dragEnter(clause2);
        fireEvent.dragOver(clause2);
        fireEvent.drop(clause2);
      });
      
      await waitFor(() => {
        const clauses = screen.getAllByTestId(/assembled-clause/);
        expect(clauses[0]).toHaveAttribute('data-testid', 'assembled-clause-clause2');
        expect(clauses[1]).toHaveAttribute('data-testid', 'assembled-clause-clause1');
      });
    });

    it('should provide visual feedback during drag operations', async () => {
      renderComponent();
      
      await waitFor(() => {
        const clause = screen.getByTestId('clause-item-clause1');
        const workspace = screen.getByTestId('assembly-workspace');
        
        fireEvent.dragStart(clause);
        fireEvent.dragEnter(workspace);
        
        expect(workspace).toHaveClass('drag-over');
        expect(screen.getByText(/drop clause here/i)).toBeInTheDocument();
      });
    });

    it('should show drop zones between clauses', async () => {
      renderComponent({ initialClauses: mockClauses });
      
      await waitFor(() => {
        const dropZones = screen.getAllByTestId(/drop-zone/);
        expect(dropZones.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Clause Dependency Management', () => {
    it('should display clause dependencies', async () => {
      renderComponent();
      
      await waitFor(() => {
        const clause = screen.getByTestId('clause-item-clause2');
        expect(within(clause).getByText(/depends on: payment terms/i)).toBeInTheDocument();
      });
    });

    it('should enforce dependency order', async () => {
      renderComponent();
      
      await waitFor(() => {
        const terminationClause = screen.getByTestId('clause-item-clause2');
        const workspace = screen.getByTestId('assembly-workspace');
        
        fireEvent.dragStart(terminationClause);
        fireEvent.dragEnter(workspace);
        fireEvent.drop(workspace);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/dependency warning/i)).toBeInTheDocument();
        expect(screen.getByText(/payment terms must be added first/i)).toBeInTheDocument();
      });
    });

    it('should suggest adding dependencies', async () => {
      renderComponent();
      
      await waitFor(() => {
        const terminationClause = screen.getByTestId('clause-item-clause2');
        fireEvent.click(terminationClause);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/missing dependencies/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /add payment terms/i })).toBeInTheDocument();
      });
    });

    it('should auto-add dependencies when requested', async () => {
      renderComponent();
      
      await waitFor(() => {
        const terminationClause = screen.getByTestId('clause-item-clause2');
        fireEvent.click(terminationClause);
        
        const addDependencyButton = screen.getByRole('button', { name: /add payment terms/i });
        fireEvent.click(addDependencyButton);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('assembled-clause-clause1')).toBeInTheDocument();
        expect(screen.getByTestId('assembled-clause-clause2')).toBeInTheDocument();
      });
    });

    it('should show dependency graph visualization', async () => {
      renderComponent();
      
      await waitFor(() => {
        const dependencyButton = screen.getByRole('button', { name: /view dependencies/i });
        fireEvent.click(dependencyButton);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('dependency-graph')).toBeInTheDocument();
        expect(screen.getByText(/clause relationships/i)).toBeInTheDocument();
      });
    });
  });

  describe('Conflict Detection', () => {
    it('should detect conflicts between clauses', async () => {
      renderComponent({ initialClauses: [mockClauses[0], mockClauses[2]] });
      
      await waitFor(() => {
        expect(screen.getByTestId('conflict-warning')).toBeInTheDocument();
        expect(screen.getByText(/conflicting payment terms/i)).toBeInTheDocument();
      });
    });

    it('should highlight conflicting clauses', async () => {
      renderComponent({ initialClauses: [mockClauses[0], mockClauses[2]] });
      
      await waitFor(() => {
        const clause1 = screen.getByTestId('assembled-clause-clause1');
        const clause3 = screen.getByTestId('assembled-clause-clause3');
        
        expect(clause1).toHaveClass('conflict-highlight');
        expect(clause3).toHaveClass('conflict-highlight');
      });
    });

    it('should provide conflict resolution suggestions', async () => {
      renderComponent({ initialClauses: [mockClauses[0], mockClauses[2]] });
      
      await waitFor(() => {
        const conflictPanel = screen.getByTestId('conflict-panel');
        expect(within(conflictPanel).getByText(/remove one payment clause/i)).toBeInTheDocument();
        expect(within(conflictPanel).getByText(/merge payment terms/i)).toBeInTheDocument();
      });
    });

    it('should allow applying conflict resolutions', async () => {
      renderComponent({ initialClauses: [mockClauses[0], mockClauses[2]] });
      
      await waitFor(() => {
        const resolveButton = screen.getByRole('button', { name: /merge payment terms/i });
        fireEvent.click(resolveButton);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('merge-dialog')).toBeInTheDocument();
        expect(screen.getByText(/merge clause contents/i)).toBeInTheDocument();
      });
    });

    it('should show conflict severity levels', async () => {
      renderComponent({ initialClauses: [mockClauses[0], mockClauses[2]] });
      
      await waitFor(() => {
        expect(screen.getByText(/severity: high/i)).toBeInTheDocument();
        expect(screen.getByTestId('severity-badge-high')).toBeInTheDocument();
      });
    });
  });

  describe('Alternative Clause Suggestions', () => {
    it('should show alternative clauses', async () => {
      renderComponent();
      
      await waitFor(() => {
        const clause = screen.getByTestId('clause-item-clause1');
        const alternativesButton = within(clause).getByRole('button', { name: /alternatives/i });
        fireEvent.click(alternativesButton);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('alternatives-panel')).toBeInTheDocument();
        expect(screen.getByText(/alternative clauses/i)).toBeInTheDocument();
      });
    });

    it('should allow replacing clauses with alternatives', async () => {
      renderComponent({ initialClauses: [mockClauses[0]] });
      
      await waitFor(() => {
        const clause = screen.getByTestId('assembled-clause-clause1');
        const replaceButton = within(clause).getByRole('button', { name: /replace/i });
        fireEvent.click(replaceButton);
      });
      
      await waitFor(() => {
        const alternativeOption = screen.getByTestId('alternative-clause4');
        fireEvent.click(alternativeOption);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('assembled-clause-clause4')).toBeInTheDocument();
        expect(screen.queryByTestId('assembled-clause-clause1')).not.toBeInTheDocument();
      });
    });

    it('should show alternative comparison', async () => {
      renderComponent();
      
      await waitFor(() => {
        const clause = screen.getByTestId('clause-item-clause1');
        const alternativesButton = within(clause).getByRole('button', { name: /alternatives/i });
        fireEvent.click(alternativesButton);
      });
      
      await waitFor(() => {
        const compareButton = screen.getByRole('button', { name: /compare/i });
        fireEvent.click(compareButton);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('comparison-view')).toBeInTheDocument();
        expect(screen.getByText(/original clause/i)).toBeInTheDocument();
        expect(screen.getByText(/alternative clause/i)).toBeInTheDocument();
      });
    });

    it('should rank alternatives by suitability', async () => {
      renderComponent();
      
      await waitFor(() => {
        const clause = screen.getByTestId('clause-item-clause1');
        const alternativesButton = within(clause).getByRole('button', { name: /alternatives/i });
        fireEvent.click(alternativesButton);
      });
      
      await waitFor(() => {
        const alternatives = screen.getAllByTestId(/alternative-/);
        expect(alternatives[0]).toHaveAttribute('data-rank', '1');
        expect(screen.getByText(/best match/i)).toBeInTheDocument();
      });
    });
  });

  describe('Clause Ordering Optimization', () => {
    it('should suggest optimal clause order', async () => {
      renderComponent({ initialClauses: mockClauses });
      
      await waitFor(() => {
        const optimizeButton = screen.getByRole('button', { name: /optimize order/i });
        fireEvent.click(optimizeButton);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('optimization-suggestions')).toBeInTheDocument();
        expect(screen.getByText(/recommended order/i)).toBeInTheDocument();
      });
    });

    it('should apply order optimization', async () => {
      renderComponent({ initialClauses: mockClauses });
      
      await waitFor(() => {
        const optimizeButton = screen.getByRole('button', { name: /optimize order/i });
        fireEvent.click(optimizeButton);
        
        const applyButton = screen.getByRole('button', { name: /apply optimization/i });
        fireEvent.click(applyButton);
      });
      
      await waitFor(() => {
        const clauses = screen.getAllByTestId(/assembled-clause/);
        expect(clauses[0]).toHaveAttribute('data-testid', 'assembled-clause-clause1'); // Payment first
        expect(clauses[1]).toHaveAttribute('data-testid', 'assembled-clause-clause2'); // Then termination
      });
    });

    it('should explain optimization rationale', async () => {
      renderComponent({ initialClauses: mockClauses });
      
      await waitFor(() => {
        const optimizeButton = screen.getByRole('button', { name: /optimize order/i });
        fireEvent.click(optimizeButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/payment terms should come before termination/i)).toBeInTheDocument();
        expect(screen.getByText(/dependencies require this order/i)).toBeInTheDocument();
      });
    });

    it('should allow manual order adjustments', async () => {
      renderComponent({ initialClauses: mockClauses });
      
      await waitFor(() => {
        const moveUpButton = screen.getAllByRole('button', { name: /move up/i })[1];
        fireEvent.click(moveUpButton);
      });
      
      await waitFor(() => {
        const clauses = screen.getAllByTestId(/assembled-clause/);
        expect(clauses[0]).toHaveAttribute('data-testid', 'assembled-clause-clause2');
      });
    });
  });

  describe('Legal Review Triggers', () => {
    it('should show clauses requiring legal review', async () => {
      renderComponent({ initialClauses: [mockClauses[1]] });
      
      await waitFor(() => {
        expect(screen.getByTestId('review-required-badge')).toBeInTheDocument();
        expect(screen.getByText(/legal review required/i)).toBeInTheDocument();
      });
    });

    it('should trigger review based on clause conditions', async () => {
      renderComponent();
      
      await waitFor(() => {
        // Add a high-value clause that triggers review
        const clause = screen.getByTestId('clause-item-clause1');
        fireEvent.dragStart(clause);
        fireEvent.drop(screen.getByTestId('assembly-workspace'));
      });
      
      await waitFor(() => {
        expect(screen.getByText(/review triggered: high value/i)).toBeInTheDocument();
      });
    });

    it('should show review trigger explanations', async () => {
      renderComponent({ initialClauses: [mockClauses[1]] });
      
      await waitFor(() => {
        const reviewBadge = screen.getByTestId('review-required-badge');
        fireEvent.click(reviewBadge);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/termination changes require legal approval/i)).toBeInTheDocument();
        expect(screen.getByText(/high risk clause detected/i)).toBeInTheDocument();
      });
    });

    it('should allow requesting legal review', async () => {
      renderComponent({ initialClauses: [mockClauses[1]] });
      
      await waitFor(() => {
        const requestReviewButton = screen.getByRole('button', { name: /request review/i });
        fireEvent.click(requestReviewButton);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('review-request-dialog')).toBeInTheDocument();
        expect(screen.getByLabelText(/review notes/i)).toBeInTheDocument();
      });
    });
  });

  describe('Clause Approval Workflows', () => {
    it('should show approval status for clauses', async () => {
      renderComponent({ initialClauses: mockClauses });
      
      await waitFor(() => {
        expect(screen.getByText(/approved/i)).toBeInTheDocument();
        expect(screen.getByText(/draft/i)).toBeInTheDocument();
        expect(screen.getByTestId('approval-status-approved')).toBeInTheDocument();
        expect(screen.getByTestId('approval-status-draft')).toBeInTheDocument();
      });
    });

    it('should allow approving draft clauses', async () => {
      renderComponent({ initialClauses: [mockClauses[2]] });
      
      await waitFor(() => {
        const approveButton = screen.getByRole('button', { name: /approve clause/i });
        fireEvent.click(approveButton);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('approval-dialog')).toBeInTheDocument();
        expect(screen.getByLabelText(/approval notes/i)).toBeInTheDocument();
      });
    });

    it('should show approval workflow steps', async () => {
      renderComponent({ initialClauses: [mockClauses[2]] });
      
      await waitFor(() => {
        const workflowButton = screen.getByRole('button', { name: /view workflow/i });
        fireEvent.click(workflowButton);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('workflow-stepper')).toBeInTheDocument();
        expect(screen.getByText(/draft/i)).toBeInTheDocument();
        expect(screen.getByText(/review/i)).toBeInTheDocument();
        expect(screen.getByText(/approved/i)).toBeInTheDocument();
      });
    });

    it('should track approval history', async () => {
      renderComponent({ initialClauses: [mockClauses[0]] });
      
      await waitFor(() => {
        const historyButton = screen.getByRole('button', { name: /approval history/i });
        fireEvent.click(historyButton);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('approval-history')).toBeInTheDocument();
        expect(screen.getByText(/approved by/i)).toBeInTheDocument();
        expect(screen.getByText(/january 15, 2024/i)).toBeInTheDocument();
      });
    });
  });

  describe('Version Tracking', () => {
    it('should show clause versions', async () => {
      renderComponent({ initialClauses: [mockClauses[1]] });
      
      await waitFor(() => {
        expect(screen.getByText(/version 2.1/i)).toBeInTheDocument();
        expect(screen.getByTestId('version-badge')).toBeInTheDocument();
      });
    });

    it('should allow viewing version history', async () => {
      renderComponent({ initialClauses: [mockClauses[1]] });
      
      await waitFor(() => {
        const versionButton = screen.getByRole('button', { name: /version history/i });
        fireEvent.click(versionButton);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('version-history-panel')).toBeInTheDocument();
        expect(screen.getByText(/version timeline/i)).toBeInTheDocument();
      });
    });

    it('should create new version on assembly save', async () => {
      renderComponent({ initialClauses: mockClauses });
      
      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save assembly/i });
        fireEvent.click(saveButton);
      });
      
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          version: expect.stringMatching(/\d+\.\d+/),
          clauses: expect.any(Array),
        })
      );
    });

    it('should compare different versions', async () => {
      renderComponent({ initialClauses: [mockClauses[1]] });
      
      await waitFor(() => {
        const versionButton = screen.getByRole('button', { name: /version history/i });
        fireEvent.click(versionButton);
        
        const compareButton = screen.getByRole('button', { name: /compare versions/i });
        fireEvent.click(compareButton);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('version-comparison')).toBeInTheDocument();
        expect(screen.getByText(/version 2.1 vs 2.0/i)).toBeInTheDocument();
      });
    });
  });

  describe('Usage Analytics', () => {
    it('should display clause usage statistics', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/usage: 150/i)).toBeInTheDocument();
        expect(screen.getByText(/rating: 4.2/i)).toBeInTheDocument();
        expect(screen.getByText(/last used: jan 15/i)).toBeInTheDocument();
      });
    });

    it('should show usage trends', async () => {
      renderComponent();
      
      await waitFor(() => {
        const analyticsButton = screen.getByRole('button', { name: /view analytics/i });
        fireEvent.click(analyticsButton);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('usage-chart')).toBeInTheDocument();
        expect(screen.getByText(/usage trends/i)).toBeInTheDocument();
      });
    });

    it('should track clause performance metrics', async () => {
      renderComponent();
      
      await waitFor(() => {
        const analyticsButton = screen.getByRole('button', { name: /view analytics/i });
        fireEvent.click(analyticsButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/completion rate: 85%/i)).toBeInTheDocument();
        expect(screen.getByText(/average review time: 2.5 days/i)).toBeInTheDocument();
      });
    });

    it('should provide usage recommendations', async () => {
      renderComponent();
      
      await waitFor(() => {
        const recommendationsButton = screen.getByRole('button', { name: /recommendations/i });
        fireEvent.click(recommendationsButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/frequently used together/i)).toBeInTheDocument();
        expect(screen.getByText(/consider adding termination clause/i)).toBeInTheDocument();
      });
    });
  });

  describe('Playbook Compliance', () => {
    it('should show playbook compliance status', async () => {
      renderComponent({ initialClauses: mockClauses });
      
      await waitFor(() => {
        expect(screen.getByTestId('compliance-badge-compliant')).toBeInTheDocument();
        expect(screen.getByTestId('compliance-badge-non-compliant')).toBeInTheDocument();
      });
    });

    it('should highlight non-compliant clauses', async () => {
      renderComponent({ initialClauses: [mockClauses[2]] });
      
      await waitFor(() => {
        const clause = screen.getByTestId('assembled-clause-clause3');
        expect(clause).toHaveClass('non-compliant');
        expect(screen.getByText(/playbook violation/i)).toBeInTheDocument();
      });
    });

    it('should provide compliance recommendations', async () => {
      renderComponent({ initialClauses: [mockClauses[2]] });
      
      await waitFor(() => {
        const complianceButton = screen.getByRole('button', { name: /compliance details/i });
        fireEvent.click(complianceButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/playbook requirements/i)).toBeInTheDocument();
        expect(screen.getByText(/add liability limitation/i)).toBeInTheDocument();
      });
    });

    it('should run full playbook compliance check', async () => {
      renderComponent({ initialClauses: mockClauses });
      
      await waitFor(() => {
        const checkButton = screen.getByRole('button', { name: /run compliance check/i });
        fireEvent.click(checkButton);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('compliance-report')).toBeInTheDocument();
        expect(screen.getByText(/compliance score: 75%/i)).toBeInTheDocument();
      });
    });

    it('should suggest playbook-compliant alternatives', async () => {
      renderComponent({ initialClauses: [mockClauses[2]] });
      
      await waitFor(() => {
        const suggestButton = screen.getByRole('button', { name: /suggest compliant clause/i });
        fireEvent.click(suggestButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/compliant alternatives/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /replace with compliant version/i })).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filtering', () => {
    it('should filter clauses by category', async () => {
      renderComponent();
      
      await waitFor(() => {
        const paymentFilter = screen.getByRole('button', { name: /payment/i });
        fireEvent.click(paymentFilter);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('clause-item-clause1')).toBeInTheDocument();
        expect(screen.queryByTestId('clause-item-clause2')).not.toBeInTheDocument();
      });
    });

    it('should search clauses by text', async () => {
      renderComponent();
      
      const searchInput = screen.getByLabelText(/search clauses/i);
      await userEvent.type(searchInput, 'termination');
      
      await waitFor(() => {
        expect(screen.getByTestId('clause-item-clause2')).toBeInTheDocument();
        expect(screen.queryByTestId('clause-item-clause1')).not.toBeInTheDocument();
      });
    });

    it('should filter by risk level', async () => {
      renderComponent();
      
      await waitFor(() => {
        const riskFilter = screen.getByLabelText(/risk level/i);
        fireEvent.change(riskFilter, { target: { value: 'high' } });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('clause-item-clause2')).toBeInTheDocument();
        expect(screen.queryByTestId('clause-item-clause1')).not.toBeInTheDocument();
      });
    });

    it('should filter by approval status', async () => {
      renderComponent();
      
      await waitFor(() => {
        const statusFilter = screen.getByLabelText(/approval status/i);
        fireEvent.change(statusFilter, { target: { value: 'draft' } });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('clause-item-clause3')).toBeInTheDocument();
        expect(screen.queryByTestId('clause-item-clause1')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Clause assembly system');
      expect(screen.getByRole('region', { name: /clause library/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /assembly workspace/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation for drag and drop', async () => {
      renderComponent();
      
      await waitFor(() => {
        const clause = screen.getByTestId('clause-item-clause1');
        clause.focus();
        
        fireEvent.keyDown(clause, { key: 'Enter' });
        expect(screen.getByText(/selected for move/i)).toBeInTheDocument();
        
        const workspace = screen.getByTestId('assembly-workspace');
        workspace.focus();
        fireEvent.keyDown(workspace, { key: 'Enter' });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('assembled-clause-clause1')).toBeInTheDocument();
      });
    });

    it('should announce drag and drop operations', async () => {
      renderComponent();
      
      await waitFor(() => {
        const clause = screen.getByTestId('clause-item-clause1');
        fireEvent.dragStart(clause);
      });
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/dragging payment terms clause/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const { api } = require('../../../services/api');
      api.get.mockRejectedValueOnce(new Error('Network error'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load clauses/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should show validation errors', async () => {
      renderComponent();
      
      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save assembly/i });
        fireEvent.click(saveButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/assembly name is required/i)).toBeInTheDocument();
      });
    });

    it('should handle save conflicts', async () => {
      const { api } = require('../../../services/api');
      api.post.mockRejectedValueOnce({ 
        response: { data: { error: 'Assembly was modified by another user' } }
      });
      
      renderComponent({ initialClauses: mockClauses });
      
      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save assembly/i });
        fireEvent.click(saveButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/assembly was modified by another user/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
      });
    });
  });
});