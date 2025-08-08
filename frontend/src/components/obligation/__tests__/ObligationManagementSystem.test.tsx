import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ObligationManagementSystem } from '../ObligationManagementSystem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '../../../services/api';

// Mock dependencies
vi.mock('../../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../../../store/auth', () => ({
  useAuthStore: () => ({
    user: {
      id: 'user1',
      name: 'John Doe',
      email: 'john@example.com',
      permissions: ['view_obligations', 'manage_obligations', 'create_reports'],
    },
  }),
}));

describe('ObligationManagementSystem', () => {
  let queryClient: QueryClient;
  const mockOnObligationUpdate = vi.fn();
  const mockOnReportGenerated = vi.fn();

  const mockObligations = [
    {
      id: 'obl1',
      contractId: 'contract1',
      contractName: 'Service Agreement',
      title: 'Monthly Service Report',
      description: 'Submit monthly service performance report',
      type: 'reporting',
      category: 'compliance',
      priority: 'high',
      status: 'active',
      assignedTo: 'user:john.doe',
      assignedTeam: 'operations',
      dueDate: '2024-02-15T17:00:00Z',
      frequency: 'monthly',
      nextDueDate: '2024-03-15T17:00:00Z',
      completionRate: 85,
      estimatedHours: 4,
      actualHours: null,
      dependencies: ['obl2'],
      parentObligation: null,
      childObligations: [],
      milestones: [
        {
          id: 'milestone1',
          name: 'Data Collection',
          dueDate: '2024-02-10T17:00:00Z',
          status: 'completed',
          completedAt: '2024-02-09T14:30:00Z',
        },
        {
          id: 'milestone2',
          name: 'Report Generation',
          dueDate: '2024-02-13T17:00:00Z',
          status: 'in_progress',
          completedAt: null,
        },
      ],
      notifications: {
        enabled: true,
        reminderDays: [7, 3, 1],
        escalationDays: 2,
        escalationTo: 'manager@company.com',
      },
      complianceScore: 92,
      riskLevel: 'medium',
      penalties: {
        applicable: true,
        amount: 5000,
        currency: 'USD',
        type: 'fixed',
      },
      evidence: [
        {
          id: 'evidence1',
          type: 'document',
          name: 'January Report.pdf',
          url: '/documents/jan-report.pdf',
          uploadedAt: '2024-01-31T16:00:00Z',
          uploadedBy: 'user:john.doe',
        },
      ],
      auditTrail: [
        {
          id: 'audit1',
          timestamp: '2024-01-20T10:00:00Z',
          action: 'obligation_created',
          user: 'system',
          details: 'Obligation extracted from contract',
        },
      ],
      createdAt: '2024-01-20T10:00:00Z',
      updatedAt: '2024-02-09T14:30:00Z',
    },
    {
      id: 'obl2',
      contractId: 'contract2',
      contractName: 'Supplier Agreement',
      title: 'Payment Processing',
      description: 'Process supplier payments within 30 days',
      type: 'payment',
      category: 'financial',
      priority: 'critical',
      status: 'overdue',
      assignedTo: 'user:jane.smith',
      assignedTeam: 'finance',
      dueDate: '2024-01-30T17:00:00Z',
      frequency: 'per_invoice',
      nextDueDate: null,
      completionRate: 45,
      estimatedHours: 2,
      actualHours: 3.5,
      dependencies: [],
      parentObligation: null,
      childObligations: [],
      milestones: [],
      notifications: {
        enabled: true,
        reminderDays: [5, 2],
        escalationDays: 1,
        escalationTo: 'cfo@company.com',
      },
      complianceScore: 65,
      riskLevel: 'high',
      penalties: {
        applicable: true,
        amount: 100,
        currency: 'USD',
        type: 'daily',
      },
      evidence: [],
      auditTrail: [],
      createdAt: '2024-01-15T09:00:00Z',
      updatedAt: '2024-01-30T17:00:00Z',
    },
  ];

  const mockMetrics = {
    totalObligations: 125,
    activeObligations: 98,
    completedThisMonth: 45,
    overdueObligations: 8,
    complianceRate: 88.5,
    averageCompletionTime: 6.2,
    riskDistribution: {
      low: 65,
      medium: 45,
      high: 12,
      critical: 3,
    },
    categoryBreakdown: {
      compliance: 42,
      financial: 28,
      operational: 35,
      legal: 20,
    },
    upcomingDeadlines: [
      {
        date: '2024-02-15',
        count: 12,
        obligations: ['obl1', 'obl3', 'obl4'],
      },
      {
        date: '2024-02-20',
        count: 8,
        obligations: ['obl5', 'obl6'],
      },
    ],
  };

  const mockReports = [
    {
      id: 'report1',
      name: 'Monthly Compliance Report',
      type: 'compliance',
      period: '2024-01',
      status: 'generated',
      createdAt: '2024-02-01T09:00:00Z',
      url: '/reports/compliance-jan-2024.pdf',
      metrics: {
        complianceRate: 89.2,
        completedObligations: 42,
        overdueObligations: 5,
      },
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    const mockApi = vi.mocked(api);
    mockApi.get.mockImplementation((url) => {
      if (url.includes('/obligations') && !url.includes('/metrics') && !url.includes('/reports')) {
        return Promise.resolve({ data: mockObligations });
      }
      if (url.includes('/obligations/metrics')) {
        return Promise.resolve({ data: mockMetrics });
      }
      if (url.includes('/obligations/reports')) {
        return Promise.resolve({ data: mockReports });
      }
      if (url.includes('/obligations/obl1')) {
        return Promise.resolve({ data: mockObligations[0] });
      }
      return Promise.resolve({ data: [] });
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ObligationManagementSystem
          onObligationUpdate={mockOnObligationUpdate}
          onReportGenerated={mockOnReportGenerated}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  describe('Initial Render', () => {
    it('should render the obligation management system', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('obligation-management')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /obligation management system/i })).toBeInTheDocument();
      });
    });

    it('should show metrics dashboard', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('metrics-dashboard')).toBeInTheDocument();
        expect(screen.getByText('Total Obligations')).toBeInTheDocument();
        expect(screen.getByText('125')).toBeInTheDocument();
        expect(screen.getByText('88.5%')).toBeInTheDocument();
      });
    });

    it('should display filter and search controls', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('obligation-filters')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/search obligations/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/filter by category/i)).toBeInTheDocument();
      });
    });

    it('should show obligations list', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('obligations-list')).toBeInTheDocument();
        expect(screen.getByText('Monthly Service Report')).toBeInTheDocument();
        expect(screen.getByText('Payment Processing')).toBeInTheDocument();
      });
    });
  });

  describe('Automated Obligation Extraction', () => {
    it('should show extraction interface', async () => {
      renderComponent({ view: 'extraction' });
      
      await waitFor(() => {
        expect(screen.getByTestId('extraction-interface')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /obligation extraction/i })).toBeInTheDocument();
      });
    });

    it('should allow contract selection for extraction', async () => {
      renderComponent({ view: 'extraction' });
      
      await waitFor(() => {
        expect(screen.getByTestId('contract-selector')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/select contract/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /extract obligations/i })).toBeInTheDocument();
      });
    });

    it('should show AI extraction preview', async () => {
      renderComponent({ view: 'extraction' });
      
      await waitFor(() => {
        const extractButton = screen.getByRole('button', { name: /extract obligations/i });
        fireEvent.click(extractButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('extraction-preview')).toBeInTheDocument();
        expect(screen.getByText(/ai identified 3 potential obligations/i)).toBeInTheDocument();
      });
    });

    it('should allow manual review of extractions', async () => {
      renderComponent({ view: 'extraction' });
      
      const extractButton = screen.getByRole('button', { name: /extract obligations/i });
      fireEvent.click(extractButton);

      await waitFor(() => {
        const reviewButton = screen.getByRole('button', { name: /review extractions/i });
        fireEvent.click(reviewButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('extraction-review')).toBeInTheDocument();
        expect(screen.getByText('Review Extracted Obligations')).toBeInTheDocument();
      });
    });

    it('should confirm bulk extraction', async () => {
      renderComponent({ view: 'extraction' });
      
      const extractButton = screen.getByRole('button', { name: /extract obligations/i });
      fireEvent.click(extractButton);

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /confirm all/i });
        fireEvent.click(confirmButton);
      });

      expect(mockOnObligationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bulk_extraction',
          count: expect.any(Number),
        })
      );
    });

    it('should show extraction confidence scores', async () => {
      renderComponent({ view: 'extraction' });
      
      await waitFor(() => {
        const extractButton = screen.getByRole('button', { name: /extract obligations/i });
        fireEvent.click(extractButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('confidence-scores')).toBeInTheDocument();
        expect(screen.getByText(/confidence: 89%/i)).toBeInTheDocument();
        expect(screen.getByText(/high confidence/i)).toBeInTheDocument();
      });
    });
  });

  describe('Obligation Categorization', () => {
    it('should display category management', async () => {
      renderComponent({ view: 'categories' });
      
      await waitFor(() => {
        expect(screen.getByTestId('category-management')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /obligation categories/i })).toBeInTheDocument();
      });
    });

    it('should show category breakdown chart', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('category-chart')).toBeInTheDocument();
        expect(screen.getByText('Compliance: 42')).toBeInTheDocument();
        expect(screen.getByText('Financial: 28')).toBeInTheDocument();
        expect(screen.getByText('Operational: 35')).toBeInTheDocument();
      });
    });

    it('should allow creating new categories', async () => {
      const user = userEvent.setup();
      renderComponent({ view: 'categories' });
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create category/i });
        user.click(createButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('category-form')).toBeInTheDocument();
        expect(screen.getByLabelText(/category name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      });
    });

    it('should support automatic categorization', async () => {
      renderComponent({ view: 'categories' });
      
      await waitFor(() => {
        const autoCategorizeButton = screen.getByRole('button', { name: /auto-categorize/i });
        fireEvent.click(autoCategorizeButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('auto-categorization')).toBeInTheDocument();
        expect(screen.getByText(/categorizing obligations/i)).toBeInTheDocument();
      });
    });

    it('should show category rules engine', async () => {
      renderComponent({ view: 'categories' });
      
      await waitFor(() => {
        const rulesButton = screen.getByRole('button', { name: /category rules/i });
        fireEvent.click(rulesButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('category-rules')).toBeInTheDocument();
        expect(screen.getByText(/if text contains "payment"/i)).toBeInTheDocument();
        expect(screen.getByText(/then category = "financial"/i)).toBeInTheDocument();
      });
    });

    it('should allow bulk recategorization', async () => {
      renderComponent();
      
      await waitFor(() => {
        const selectAllCheckbox = screen.getByLabelText(/select all obligations/i);
        fireEvent.click(selectAllCheckbox);
      });

      await waitFor(() => {
        const bulkButton = screen.getByRole('button', { name: /bulk actions/i });
        fireEvent.click(bulkButton);
      });

      await waitFor(() => {
        const recategorizeOption = screen.getByText(/recategorize/i);
        fireEvent.click(recategorizeOption);
      });

      expect(screen.getByTestId('bulk-recategorization')).toBeInTheDocument();
    });
  });

  describe('Responsible Party Assignment', () => {
    it('should show assignment interface', async () => {
      renderComponent({ view: 'assignments' });
      
      await waitFor(() => {
        expect(screen.getByTestId('assignment-interface')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /responsibility assignment/i })).toBeInTheDocument();
      });
    });

    it('should display team workload distribution', async () => {
      renderComponent({ view: 'assignments' });
      
      await waitFor(() => {
        expect(screen.getByTestId('workload-chart')).toBeInTheDocument();
        expect(screen.getByText('Operations Team')).toBeInTheDocument();
        expect(screen.getByText('Finance Team')).toBeInTheDocument();
      });
    });

    it('should allow individual assignment', async () => {
      renderComponent();
      
      await waitFor(() => {
        const obligationCard = screen.getByTestId('obligation-obl1');
        const assignButton = within(obligationCard).getByRole('button', { name: /assign/i });
        fireEvent.click(assignButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('assignment-modal')).toBeInTheDocument();
        expect(screen.getByLabelText(/assign to user/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/assign to team/i)).toBeInTheDocument();
      });
    });

    it('should support smart assignment suggestions', async () => {
      renderComponent();
      
      await waitFor(() => {
        const obligationCard = screen.getByTestId('obligation-obl1');
        const assignButton = within(obligationCard).getByRole('button', { name: /assign/i });
        fireEvent.click(assignButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('smart-suggestions')).toBeInTheDocument();
        expect(screen.getByText(/suggested based on expertise/i)).toBeInTheDocument();
        expect(screen.getByText(/john.doe - 95% match/i)).toBeInTheDocument();
      });
    });

    it('should show assignment history', async () => {
      renderComponent();
      
      await waitFor(() => {
        const obligationCard = screen.getByTestId('obligation-obl1');
        const historyButton = within(obligationCard).getByRole('button', { name: /history/i });
        fireEvent.click(historyButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('assignment-history')).toBeInTheDocument();
        expect(screen.getByText('Assignment History')).toBeInTheDocument();
      });
    });

    it('should handle bulk assignments', async () => {
      renderComponent();
      
      await waitFor(() => {
        const selectAllCheckbox = screen.getByLabelText(/select all obligations/i);
        fireEvent.click(selectAllCheckbox);
      });

      await waitFor(() => {
        const bulkAssignButton = screen.getByRole('button', { name: /bulk assign/i });
        fireEvent.click(bulkAssignButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('bulk-assignment')).toBeInTheDocument();
        expect(screen.getByText('Assign 2 selected obligations')).toBeInTheDocument();
      });
    });
  });

  describe('Deadline Calculation Engine', () => {
    it('should show deadline calculation interface', async () => {
      renderComponent({ view: 'deadlines' });
      
      await waitFor(() => {
        expect(screen.getByTestId('deadline-engine')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /deadline management/i })).toBeInTheDocument();
      });
    });

    it('should display upcoming deadlines calendar', async () => {
      renderComponent({ view: 'deadlines' });
      
      await waitFor(() => {
        expect(screen.getByTestId('deadline-calendar')).toBeInTheDocument();
        expect(screen.getByText('Feb 15: 12 obligations due')).toBeInTheDocument();
        expect(screen.getByText('Feb 20: 8 obligations due')).toBeInTheDocument();
      });
    });

    it('should calculate business days correctly', async () => {
      renderComponent();
      
      await waitFor(() => {
        const obligationCard = screen.getByTestId('obligation-obl1');
        expect(within(obligationCard).getByText(/6 business days remaining/i)).toBeInTheDocument();
      });
    });

    it('should show deadline rules configuration', async () => {
      renderComponent({ view: 'deadlines' });
      
      await waitFor(() => {
        const rulesButton = screen.getByRole('button', { name: /deadline rules/i });
        fireEvent.click(rulesButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('deadline-rules')).toBeInTheDocument();
        expect(screen.getByText(/payment obligations: 30 days/i)).toBeInTheDocument();
        expect(screen.getByText(/reporting obligations: monthly/i)).toBeInTheDocument();
      });
    });

    it('should handle deadline extensions', async () => {
      renderComponent();
      
      await waitFor(() => {
        const obligationCard = screen.getByTestId('obligation-obl2');
        const extendButton = within(obligationCard).getByRole('button', { name: /extend deadline/i });
        fireEvent.click(extendButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('deadline-extension')).toBeInTheDocument();
        expect(screen.getByLabelText(/extension reason/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/new due date/i)).toBeInTheDocument();
      });
    });

    it('should show critical path analysis', async () => {
      renderComponent({ view: 'deadlines' });
      
      await waitFor(() => {
        const criticalPathButton = screen.getByRole('button', { name: /critical path/i });
        fireEvent.click(criticalPathButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('critical-path')).toBeInTheDocument();
        expect(screen.getByText('Critical Path Analysis')).toBeInTheDocument();
      });
    });
  });

  describe('Recurring Obligation Handling', () => {
    it('should show recurring obligations view', async () => {
      renderComponent({ view: 'recurring' });
      
      await waitFor(() => {
        expect(screen.getByTestId('recurring-obligations')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /recurring obligations/i })).toBeInTheDocument();
      });
    });

    it('should display recurrence patterns', async () => {
      renderComponent();
      
      await waitFor(() => {
        const recurringObligation = screen.getByTestId('obligation-obl1');
        expect(within(recurringObligation).getByTestId('recurrence-indicator')).toBeInTheDocument();
        expect(within(recurringObligation).getByText('Monthly')).toBeInTheDocument();
      });
    });

    it('should show next occurrence dates', async () => {
      renderComponent();
      
      await waitFor(() => {
        const recurringObligation = screen.getByTestId('obligation-obl1');
        expect(within(recurringObligation).getByText(/next: mar 15, 2024/i)).toBeInTheDocument();
      });
    });

    it('should allow recurrence configuration', async () => {
      renderComponent();
      
      await waitFor(() => {
        const obligationCard = screen.getByTestId('obligation-obl1');
        const configButton = within(obligationCard).getByRole('button', { name: /configure recurrence/i });
        fireEvent.click(configButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('recurrence-config')).toBeInTheDocument();
        expect(screen.getByLabelText(/frequency/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/end condition/i)).toBeInTheDocument();
      });
    });

    it('should handle bulk completion of recurring obligations', async () => {
      renderComponent({ view: 'recurring' });
      
      await waitFor(() => {
        const bulkCompleteButton = screen.getByRole('button', { name: /bulk complete series/i });
        fireEvent.click(bulkCompleteButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('bulk-completion')).toBeInTheDocument();
        expect(screen.getByText('Complete Multiple Occurrences')).toBeInTheDocument();
      });
    });

    it('should show recurrence history', async () => {
      renderComponent();
      
      await waitFor(() => {
        const obligationCard = screen.getByTestId('obligation-obl1');
        const historyButton = within(obligationCard).getByRole('button', { name: /recurrence history/i });
        fireEvent.click(historyButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('recurrence-history')).toBeInTheDocument();
        expect(screen.getByText('Recurrence History')).toBeInTheDocument();
      });
    });
  });

  describe('Milestone Tracking', () => {
    it('should display obligation milestones', async () => {
      renderComponent();
      
      await waitFor(() => {
        const obligationCard = screen.getByTestId('obligation-obl1');
        expect(within(obligationCard).getByTestId('milestones-progress')).toBeInTheDocument();
        expect(within(obligationCard).getByText('1 of 2 completed')).toBeInTheDocument();
      });
    });

    it('should show milestone timeline', async () => {
      renderComponent();
      
      await waitFor(() => {
        const obligationCard = screen.getByTestId('obligation-obl1');
        const timelineButton = within(obligationCard).getByRole('button', { name: /view timeline/i });
        fireEvent.click(timelineButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('milestone-timeline')).toBeInTheDocument();
        expect(screen.getByText('Data Collection')).toBeInTheDocument();
        expect(screen.getByText('Report Generation')).toBeInTheDocument();
      });
    });

    it('should allow milestone completion', async () => {
      renderComponent();
      
      await waitFor(() => {
        const obligationCard = screen.getByTestId('obligation-obl1');
        const timelineButton = within(obligationCard).getByRole('button', { name: /view timeline/i });
        fireEvent.click(timelineButton);
      });

      await waitFor(() => {
        const completeButton = screen.getByTestId('complete-milestone-milestone2');
        fireEvent.click(completeButton);
      });

      expect(mockOnObligationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'milestone_completion',
          milestoneId: 'milestone2',
        })
      );
    });

    it('should create milestone dependencies', async () => {
      renderComponent();
      
      await waitFor(() => {
        const obligationCard = screen.getByTestId('obligation-obl1');
        const dependenciesButton = within(obligationCard).getByRole('button', { name: /dependencies/i });
        fireEvent.click(dependenciesButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('milestone-dependencies')).toBeInTheDocument();
        expect(screen.getByText('Milestone Dependencies')).toBeInTheDocument();
      });
    });

    it('should show milestone progress indicators', async () => {
      renderComponent();
      
      await waitFor(() => {
        const progressBar = screen.getByTestId('overall-progress');
        expect(progressBar).toBeInTheDocument();
        expect(screen.getByText(/50% complete/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance Metrics', () => {
    it('should display performance dashboard', async () => {
      renderComponent({ view: 'performance' });
      
      await waitFor(() => {
        expect(screen.getByTestId('performance-dashboard')).toBeInTheDocument();
        expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
      });
    });

    it('should show completion rate trends', async () => {
      renderComponent({ view: 'performance' });
      
      await waitFor(() => {
        expect(screen.getByTestId('completion-trends')).toBeInTheDocument();
        expect(screen.getByText('85% average completion rate')).toBeInTheDocument();
      });
    });

    it('should display time tracking metrics', async () => {
      renderComponent({ view: 'performance' });
      
      await waitFor(() => {
        expect(screen.getByTestId('time-metrics')).toBeInTheDocument();
        expect(screen.getByText('Average completion: 6.2 hours')).toBeInTheDocument();
      });
    });

    it('should show team performance comparison', async () => {
      renderComponent({ view: 'performance' });
      
      await waitFor(() => {
        expect(screen.getByTestId('team-comparison')).toBeInTheDocument();
        expect(screen.getByText('Team Performance Comparison')).toBeInTheDocument();
      });
    });

    it('should generate performance reports', async () => {
      renderComponent({ view: 'performance' });
      
      await waitFor(() => {
        const generateButton = screen.getByRole('button', { name: /generate report/i });
        fireEvent.click(generateButton);
      });

      expect(mockOnReportGenerated).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'performance',
        })
      );
    });
  });

  describe('Compliance Scoring', () => {
    it('should display compliance scores', async () => {
      renderComponent();
      
      await waitFor(() => {
        const obligationCard = screen.getByTestId('obligation-obl1');
        expect(within(obligationCard).getByTestId('compliance-score')).toBeInTheDocument();
        expect(within(obligationCard).getByText('92%')).toBeInTheDocument();
      });
    });

    it('should show risk level indicators', async () => {
      renderComponent();
      
      await waitFor(() => {
        const obligationCard = screen.getByTestId('obligation-obl1');
        const riskBadge = within(obligationCard).getByTestId('risk-level');
        expect(riskBadge).toHaveTextContent('Medium');
        expect(riskBadge).toHaveClass(/bg-yellow-/);
      });
    });

    it('should display compliance trends', async () => {
      renderComponent({ view: 'compliance' });
      
      await waitFor(() => {
        expect(screen.getByTestId('compliance-trends')).toBeInTheDocument();
        expect(screen.getByText('Compliance Score: 88.5%')).toBeInTheDocument();
      });
    });

    it('should show penalty calculations', async () => {
      renderComponent();
      
      await waitFor(() => {
        const overdueObligation = screen.getByTestId('obligation-obl2');
        expect(within(overdueObligation).getByTestId('penalty-info')).toBeInTheDocument();
        expect(within(overdueObligation).getByText('$100/day penalty')).toBeInTheDocument();
      });
    });

    it('should calculate compliance improvement suggestions', async () => {
      renderComponent({ view: 'compliance' });
      
      await waitFor(() => {
        expect(screen.getByTestId('improvement-suggestions')).toBeInTheDocument();
        expect(screen.getByText('Improvement Suggestions')).toBeInTheDocument();
      });
    });
  });

  describe('Escalation Procedures', () => {
    it('should show escalation configuration', async () => {
      renderComponent({ view: 'escalations' });
      
      await waitFor(() => {
        expect(screen.getByTestId('escalation-config')).toBeInTheDocument();
        expect(screen.getByText('Escalation Procedures')).toBeInTheDocument();
      });
    });

    it('should display active escalations', async () => {
      renderComponent({ view: 'escalations' });
      
      await waitFor(() => {
        expect(screen.getByTestId('active-escalations')).toBeInTheDocument();
        expect(screen.getByText('2 obligations require escalation')).toBeInTheDocument();
      });
    });

    it('should trigger manual escalation', async () => {
      renderComponent();
      
      await waitFor(() => {
        const overdueObligation = screen.getByTestId('obligation-obl2');
        const escalateButton = within(overdueObligation).getByRole('button', { name: /escalate/i });
        fireEvent.click(escalateButton);
      });

      expect(mockOnObligationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'manual_escalation',
          obligationId: 'obl2',
        })
      );
    });

    it('should show escalation history', async () => {
      renderComponent({ view: 'escalations' });
      
      await waitFor(() => {
        const historyButton = screen.getByRole('button', { name: /escalation history/i });
        fireEvent.click(historyButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('escalation-history')).toBeInTheDocument();
        expect(screen.getByText('Escalation History')).toBeInTheDocument();
      });
    });
  });

  describe('Obligation Reporting', () => {
    it('should show reporting interface', async () => {
      renderComponent({ view: 'reports' });
      
      await waitFor(() => {
        expect(screen.getByTestId('reporting-interface')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /obligation reporting/i })).toBeInTheDocument();
      });
    });

    it('should display available report types', async () => {
      renderComponent({ view: 'reports' });
      
      await waitFor(() => {
        expect(screen.getByTestId('report-types')).toBeInTheDocument();
        expect(screen.getByText('Compliance Report')).toBeInTheDocument();
        expect(screen.getByText('Performance Report')).toBeInTheDocument();
        expect(screen.getByText('Risk Assessment')).toBeInTheDocument();
      });
    });

    it('should generate custom reports', async () => {
      renderComponent({ view: 'reports' });
      
      await waitFor(() => {
        const customReportButton = screen.getByRole('button', { name: /create custom report/i });
        fireEvent.click(customReportButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('custom-report-builder')).toBeInTheDocument();
        expect(screen.getByText('Report Builder')).toBeInTheDocument();
      });
    });

    it('should show generated reports list', async () => {
      renderComponent({ view: 'reports' });
      
      await waitFor(() => {
        expect(screen.getByTestId('generated-reports')).toBeInTheDocument();
        expect(screen.getByText('Monthly Compliance Report')).toBeInTheDocument();
      });
    });

    it('should schedule automatic reports', async () => {
      renderComponent({ view: 'reports' });
      
      await waitFor(() => {
        const scheduleButton = screen.getByRole('button', { name: /schedule reports/i });
        fireEvent.click(scheduleButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('report-scheduler')).toBeInTheDocument();
        expect(screen.getByLabelText(/frequency/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle obligation loading errors', async () => {
      const mockApi = vi.mocked(api);
      mockApi.get.mockRejectedValueOnce(new Error('Failed to load obligations'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load obligations/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should validate obligation completion', async () => {
      renderComponent();
      
      await waitFor(() => {
        const obligationCard = screen.getByTestId('obligation-obl1');
        const completeButton = within(obligationCard).getByRole('button', { name: /complete/i });
        fireEvent.click(completeButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/please provide completion evidence/i)).toBeInTheDocument();
      });
    });

    it('should show loading states', () => {
      renderComponent();
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText(/loading obligations/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Obligation Management System');
        expect(screen.getByRole('region', { name: /metrics dashboard/i })).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const firstObligation = screen.getByTestId('obligation-obl1');
        firstObligation.focus();
        
        user.keyboard('{Enter}');
      });

      await waitFor(() => {
        expect(screen.getByTestId('obligation-details-obl1')).toBeInTheDocument();
      });
    });

    it('should announce important updates', async () => {
      renderComponent();
      
      await waitFor(() => {
        const obligationCard = screen.getByTestId('obligation-obl1');
        const completeButton = within(obligationCard).getByRole('button', { name: /complete/i });
        fireEvent.click(completeButton);
      });

      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/obligation status updated/i);
      });
    });
  });

  describe('Integration Features', () => {
    it('should filter obligations by search term', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search obligations/i);
        user.type(searchInput, 'payment');
      });

      await waitFor(() => {
        expect(screen.getByTestId('obligation-obl2')).toBeInTheDocument();
        expect(screen.queryByTestId('obligation-obl1')).not.toBeInTheDocument();
      });
    });

    it('should filter by status', async () => {
      renderComponent();
      
      await waitFor(() => {
        const statusFilter = screen.getByLabelText(/filter by status/i);
        fireEvent.change(statusFilter, { target: { value: 'overdue' } });
      });

      await waitFor(() => {
        expect(screen.getByTestId('obligation-obl2')).toBeInTheDocument();
        expect(screen.queryByTestId('obligation-obl1')).not.toBeInTheDocument();
      });
    });

    it('should export obligations data', async () => {
      renderComponent();
      
      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /export/i });
        fireEvent.click(exportButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('export-options')).toBeInTheDocument();
        expect(screen.getByText('CSV')).toBeInTheDocument();
        expect(screen.getByText('PDF')).toBeInTheDocument();
      });
    });
  });
});