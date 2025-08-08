import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { RenewalManagementPlatform } from '../RenewalManagementPlatform';
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
      permissions: ['view_renewals', 'manage_renewals', 'approve_renewals'],
    },
  }),
}));

describe('RenewalManagementPlatform', () => {
  let queryClient: QueryClient;
  const mockOnRenewalUpdate = vi.fn();
  const mockOnStrategyApplied = vi.fn();

  const mockRenewals = [
    {
      id: 'renewal1',
      contractId: 'contract1',
      contractName: 'Software License Agreement',
      vendorName: 'TechCorp Solutions',
      currentValue: 150000,
      renewalDate: '2024-06-15T00:00:00Z',
      noticeDate: '2024-05-15T00:00:00Z',
      noticePeriodDays: 30,
      autoRenewal: true,
      autoRenewalClause: 'Contract will auto-renew for 1 year unless notice given 30 days prior',
      renewalTerm: '1 year',
      status: 'upcoming',
      priority: 'high',
      priceAdjustment: {
        type: 'percentage',
        value: 3,
        basis: 'CPI',
        lastAdjustment: '2023-06-15T00:00:00Z',
        projectedValue: 154500,
      },
      vendorPerformance: {
        score: 85,
        rating: 'good',
        issuesCount: 2,
        slaCompliance: 95,
        lastReview: '2024-01-15T00:00:00Z',
      },
      strategy: {
        recommendation: 'renew_negotiate',
        reasoning: 'Good vendor performance, slight price reduction possible',
        alternativeVendors: ['AlterCorp', 'BetaTech'],
        savingsOpportunity: 7500,
        riskScore: 'low',
      },
      negotiationTriggers: [
        {
          id: 'trigger1',
          type: 'price_increase',
          threshold: 5,
          triggered: false,
          description: 'Price increase exceeds 5%',
        },
        {
          id: 'trigger2',
          type: 'performance_decline',
          threshold: 80,
          triggered: false,
          description: 'Performance score below 80',
        },
      ],
      documents: [
        {
          id: 'doc1',
          name: 'Current Contract.pdf',
          type: 'contract',
          uploadedAt: '2023-06-01T10:00:00Z',
        },
      ],
      timeline: [
        {
          id: 'event1',
          date: '2024-05-15T00:00:00Z',
          type: 'notice_deadline',
          description: 'Notice period deadline',
          status: 'pending',
        },
        {
          id: 'event2',
          date: '2024-06-15T00:00:00Z',
          type: 'renewal_date',
          description: 'Contract renewal date',
          status: 'pending',
        },
      ],
      stakeholders: [
        {
          id: 'stakeholder1',
          name: 'Jane Smith',
          role: 'Procurement Manager',
          email: 'jane@company.com',
          responsibility: 'approval',
        },
      ],
      createdAt: '2023-06-01T10:00:00Z',
      updatedAt: '2024-02-01T14:30:00Z',
    },
    {
      id: 'renewal2',
      contractId: 'contract2',
      contractName: 'Maintenance Services',
      vendorName: 'ServicePro Inc',
      currentValue: 75000,
      renewalDate: '2024-04-30T00:00:00Z',
      noticeDate: '2024-03-15T00:00:00Z',
      noticePeriodDays: 45,
      autoRenewal: false,
      autoRenewalClause: null,
      renewalTerm: '2 years',
      status: 'review_required',
      priority: 'critical',
      priceAdjustment: {
        type: 'fixed',
        value: 2000,
        basis: 'annual',
        lastAdjustment: '2022-04-30T00:00:00Z',
        projectedValue: 77000,
      },
      vendorPerformance: {
        score: 72,
        rating: 'fair',
        issuesCount: 8,
        slaCompliance: 78,
        lastReview: '2024-01-30T00:00:00Z',
      },
      strategy: {
        recommendation: 'replace_vendor',
        reasoning: 'Poor performance, multiple SLA breaches',
        alternativeVendors: ['QualityService', 'ProMaintenance', 'EliteSupport'],
        savingsOpportunity: 15000,
        riskScore: 'high',
      },
      negotiationTriggers: [
        {
          id: 'trigger3',
          type: 'sla_breach',
          threshold: 80,
          triggered: true,
          description: 'SLA compliance below 80%',
        },
      ],
      documents: [],
      timeline: [],
      stakeholders: [],
      createdAt: '2022-04-01T09:00:00Z',
      updatedAt: '2024-02-10T11:00:00Z',
    },
  ];

  const mockAnalytics = {
    totalRenewals: 45,
    upcomingRenewals: 12,
    autoRenewals: 28,
    manualRenewals: 17,
    totalValue: 5250000,
    averageNoticeperiod: 35,
    renewalRate: 82,
    vendorRetentionRate: 78,
    costSavingsAchieved: 125000,
    avgPriceIncrease: 3.2,
    riskDistribution: {
      low: 25,
      medium: 15,
      high: 5,
    },
    statusBreakdown: {
      upcoming: 20,
      review_required: 10,
      in_negotiation: 8,
      completed: 7,
    },
    monthlyTrends: [
      { month: 'Jan', renewals: 4, value: 425000 },
      { month: 'Feb', renewals: 6, value: 620000 },
      { month: 'Mar', renewals: 5, value: 510000 },
    ],
  };

  const mockStrategies = [
    {
      id: 'strategy1',
      name: 'Cost Optimization',
      description: 'Focus on reducing costs through negotiation',
      rules: [
        'If price increase > 5%, then negotiate',
        'If vendor performance < 75, then consider alternatives',
      ],
      applicableCount: 12,
    },
    {
      id: 'strategy2',
      name: 'Vendor Consolidation',
      description: 'Reduce vendor count by consolidating services',
      rules: [
        'If multiple vendors in same category, then consolidate',
        'If vendor has < 3 contracts, then evaluate consolidation',
      ],
      applicableCount: 8,
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
      if (url.includes('/renewals') && !url.includes('/analytics')) {
        return Promise.resolve({ data: mockRenewals });
      }
      if (url.includes('/renewals/analytics')) {
        return Promise.resolve({ data: mockAnalytics });
      }
      if (url.includes('/renewal-strategies')) {
        return Promise.resolve({ data: mockStrategies });
      }
      if (url.includes('/renewals/renewal1')) {
        return Promise.resolve({ data: mockRenewals[0] });
      }
      return Promise.resolve({ data: [] });
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <RenewalManagementPlatform
          onRenewalUpdate={mockOnRenewalUpdate}
          onStrategyApplied={mockOnStrategyApplied}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  describe('Initial Render', () => {
    it('should render the renewal management platform', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('renewal-management')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /renewal management platform/i })).toBeInTheDocument();
      });
    });

    it('should display analytics dashboard', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
        expect(screen.getByText('Total Renewals')).toBeInTheDocument();
        expect(screen.getByText('45')).toBeInTheDocument();
        expect(screen.getByText('82%')).toBeInTheDocument();
      });
    });

    it('should show renewal filters', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('renewal-filters')).toBeInTheDocument();
        expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/filter by priority/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/search renewals/i)).toBeInTheDocument();
      });
    });

    it('should display renewals list', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('renewals-list')).toBeInTheDocument();
        expect(screen.getByText('Software License Agreement')).toBeInTheDocument();
        expect(screen.getByText('Maintenance Services')).toBeInTheDocument();
      });
    });
  });

  describe('Renewal Date Tracking', () => {
    it('should display renewal dates clearly', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal1 = screen.getByTestId('renewal-renewal1');
        expect(within(renewal1).getByText(/jun 15, 2024/i)).toBeInTheDocument();
        expect(within(renewal1).getByTestId('days-until-renewal')).toBeInTheDocument();
      });
    });

    it('should show renewal timeline', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal1 = screen.getByTestId('renewal-renewal1');
        fireEvent.click(within(renewal1).getByRole('button', { name: /view timeline/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('renewal-timeline')).toBeInTheDocument();
        expect(screen.getByText('Notice period deadline')).toBeInTheDocument();
        expect(screen.getByText('Contract renewal date')).toBeInTheDocument();
      });
    });

    it('should display calendar view', async () => {
      renderComponent({ view: 'calendar' });
      
      await waitFor(() => {
        expect(screen.getByTestId('renewal-calendar')).toBeInTheDocument();
        expect(screen.getByText(/june 2024/i)).toBeInTheDocument();
      });
    });

    it('should allow date range filtering', async () => {
      renderComponent();
      
      await waitFor(() => {
        const dateRangeButton = screen.getByRole('button', { name: /date range/i });
        fireEvent.click(dateRangeButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('date-range-picker')).toBeInTheDocument();
        expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
      });
    });
  });

  describe('Auto-Renewal Detection', () => {
    it('should identify auto-renewal contracts', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal1 = screen.getByTestId('renewal-renewal1');
        expect(within(renewal1).getByTestId('auto-renewal-badge')).toBeInTheDocument();
        expect(within(renewal1).getByText('Auto-Renewal')).toBeInTheDocument();
      });
    });

    it('should display auto-renewal clause', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal1 = screen.getByTestId('renewal-renewal1');
        fireEvent.click(within(renewal1).getByRole('button', { name: /view clause/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('auto-renewal-clause')).toBeInTheDocument();
        expect(screen.getByText(/auto-renew for 1 year/i)).toBeInTheDocument();
      });
    });

    it('should filter by auto-renewal status', async () => {
      renderComponent();
      
      await waitFor(() => {
        const autoRenewalFilter = screen.getByLabelText(/auto-renewal only/i);
        fireEvent.click(autoRenewalFilter);
      });

      await waitFor(() => {
        const renewals = screen.getAllByTestId(/^renewal-/);
        expect(renewals).toHaveLength(1);
        expect(screen.getByText('Software License Agreement')).toBeInTheDocument();
      });
    });

    it('should show auto-renewal prevention options', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal1 = screen.getByTestId('renewal-renewal1');
        const preventButton = within(renewal1).getByRole('button', { name: /prevent auto-renewal/i });
        fireEvent.click(preventButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('prevention-options')).toBeInTheDocument();
        expect(screen.getByText('Send termination notice')).toBeInTheDocument();
      });
    });
  });

  describe('Notice Period Calculations', () => {
    it('should display notice period information', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal1 = screen.getByTestId('renewal-renewal1');
        expect(within(renewal1).getByText('30 days notice')).toBeInTheDocument();
        expect(within(renewal1).getByText(/notice by: may 15/i)).toBeInTheDocument();
      });
    });

    it('should highlight approaching notice deadlines', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal2 = screen.getByTestId('renewal-renewal2');
        expect(within(renewal2).getByTestId('notice-warning')).toBeInTheDocument();
        expect(within(renewal2).getByText(/notice deadline approaching/i)).toBeInTheDocument();
      });
    });

    it('should calculate business days for notice', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal1 = screen.getByTestId('renewal-renewal1');
        const noticeInfo = within(renewal1).getByTestId('notice-info');
        expect(within(noticeInfo).getByText(/22 business days/i)).toBeInTheDocument();
      });
    });

    it('should allow notice period override', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal1 = screen.getByTestId('renewal-renewal1');
        const editButton = within(renewal1).getByRole('button', { name: /edit notice/i });
        fireEvent.click(editButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('notice-edit-form')).toBeInTheDocument();
        expect(screen.getByLabelText(/custom notice period/i)).toBeInTheDocument();
      });
    });
  });

  describe('Renewal Strategy Recommendations', () => {
    it('should display strategy recommendations', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal1 = screen.getByTestId('renewal-renewal1');
        expect(within(renewal1).getByTestId('strategy-badge')).toBeInTheDocument();
        expect(within(renewal1).getByText('Renew & Negotiate')).toBeInTheDocument();
      });
    });

    it('should show strategy reasoning', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal1 = screen.getByTestId('renewal-renewal1');
        fireEvent.click(within(renewal1).getByRole('button', { name: /view strategy/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('strategy-details')).toBeInTheDocument();
        expect(screen.getByText(/good vendor performance/i)).toBeInTheDocument();
        expect(screen.getByText(/savings opportunity: \$7,500/i)).toBeInTheDocument();
      });
    });

    it('should display alternative vendors', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal2 = screen.getByTestId('renewal-renewal2');
        fireEvent.click(within(renewal2).getByRole('button', { name: /view alternatives/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('alternative-vendors')).toBeInTheDocument();
        expect(screen.getByText('QualityService')).toBeInTheDocument();
        expect(screen.getByText('ProMaintenance')).toBeInTheDocument();
      });
    });

    it('should allow strategy application', async () => {
      renderComponent();
      
      await waitFor(() => {
        const applyButton = screen.getByRole('button', { name: /apply strategy/i });
        fireEvent.click(applyButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('strategy-application')).toBeInTheDocument();
        expect(screen.getByText('Cost Optimization')).toBeInTheDocument();
      });
    });

    it('should show risk assessment', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal2 = screen.getByTestId('renewal-renewal2');
        const riskBadge = within(renewal2).getByTestId('risk-badge');
        expect(riskBadge).toHaveTextContent('High Risk');
        expect(riskBadge).toHaveClass(/bg-red-/);
      });
    });
  });

  describe('Price Adjustment Tracking', () => {
    it('should display price adjustment information', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal1 = screen.getByTestId('renewal-renewal1');
        expect(within(renewal1).getByText('3% CPI adjustment')).toBeInTheDocument();
        expect(within(renewal1).getByText('$154,500')).toBeInTheDocument();
      });
    });

    it('should show price history', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal1 = screen.getByTestId('renewal-renewal1');
        fireEvent.click(within(renewal1).getByRole('button', { name: /price history/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('price-history')).toBeInTheDocument();
        expect(screen.getByText('Last adjustment: Jun 15, 2023')).toBeInTheDocument();
      });
    });

    it('should calculate projected costs', async () => {
      renderComponent();
      
      await waitFor(() => {
        const projectionButton = screen.getByRole('button', { name: /cost projections/i });
        fireEvent.click(projectionButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('cost-projections')).toBeInTheDocument();
        expect(screen.getByText(/3-year projection/i)).toBeInTheDocument();
      });
    });

    it('should allow custom price adjustments', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const adjustButton = screen.getByRole('button', { name: /adjust pricing/i });
        user.click(adjustButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('price-adjustment-form')).toBeInTheDocument();
        expect(screen.getByLabelText(/adjustment type/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/adjustment value/i)).toBeInTheDocument();
      });
    });
  });

  describe('Renewal Workflow Automation', () => {
    it('should show workflow status', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal2 = screen.getByTestId('renewal-renewal2');
        expect(within(renewal2).getByTestId('workflow-status')).toBeInTheDocument();
        expect(within(renewal2).getByText('Review Required')).toBeInTheDocument();
      });
    });

    it('should display workflow actions', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal2 = screen.getByTestId('renewal-renewal2');
        const actionsButton = within(renewal2).getByRole('button', { name: /actions/i });
        fireEvent.click(actionsButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('workflow-actions')).toBeInTheDocument();
        expect(screen.getByText('Start Negotiation')).toBeInTheDocument();
        expect(screen.getByText('Request Approval')).toBeInTheDocument();
      });
    });

    it('should allow workflow configuration', async () => {
      renderComponent({ view: 'workflows' });
      
      await waitFor(() => {
        expect(screen.getByTestId('workflow-configuration')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /renewal workflows/i })).toBeInTheDocument();
      });
    });

    it('should trigger automated actions', async () => {
      renderComponent();
      
      await waitFor(() => {
        const automateButton = screen.getByRole('button', { name: /automate renewals/i });
        fireEvent.click(automateButton);
      });

      expect(mockOnRenewalUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'automation_triggered',
        })
      );
    });
  });

  describe('Vendor Performance Integration', () => {
    it('should display vendor performance scores', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal1 = screen.getByTestId('renewal-renewal1');
        expect(within(renewal1).getByTestId('vendor-score')).toBeInTheDocument();
        expect(within(renewal1).getByText('85')).toBeInTheDocument();
        expect(within(renewal1).getByText('Good')).toBeInTheDocument();
      });
    });

    it('should show SLA compliance', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal1 = screen.getByTestId('renewal-renewal1');
        expect(within(renewal1).getByText('95% SLA')).toBeInTheDocument();
      });
    });

    it('should display performance issues', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal2 = screen.getByTestId('renewal-renewal2');
        expect(within(renewal2).getByTestId('issue-count')).toBeInTheDocument();
        expect(within(renewal2).getByText('8 issues')).toBeInTheDocument();
      });
    });

    it('should link to vendor dashboard', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal1 = screen.getByTestId('renewal-renewal1');
        const vendorLink = within(renewal1).getByRole('link', { name: /view vendor details/i });
        expect(vendorLink).toHaveAttribute('href', expect.stringContaining('/vendors/'));
      });
    });
  });

  describe('Renewal Negotiation Triggers', () => {
    it('should display negotiation triggers', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal1 = screen.getByTestId('renewal-renewal1');
        fireEvent.click(within(renewal1).getByRole('button', { name: /triggers/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('negotiation-triggers')).toBeInTheDocument();
        expect(screen.getByText('Price increase exceeds 5%')).toBeInTheDocument();
      });
    });

    it('should highlight triggered conditions', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal2 = screen.getByTestId('renewal-renewal2');
        const triggerAlert = within(renewal2).getByTestId('trigger-alert');
        expect(triggerAlert).toBeInTheDocument();
        expect(within(triggerAlert).getByText(/sla breach trigger/i)).toBeInTheDocument();
      });
    });

    it('should allow trigger configuration', async () => {
      renderComponent();
      
      await waitFor(() => {
        const configButton = screen.getByRole('button', { name: /configure triggers/i });
        fireEvent.click(configButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('trigger-configuration')).toBeInTheDocument();
        expect(screen.getByLabelText(/trigger type/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/threshold value/i)).toBeInTheDocument();
      });
    });

    it('should initiate negotiation on trigger', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal2 = screen.getByTestId('renewal-renewal2');
        const negotiateButton = within(renewal2).getByRole('button', { name: /start negotiation/i });
        fireEvent.click(negotiateButton);
      });

      expect(mockOnRenewalUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'negotiation_started',
          renewalId: 'renewal2',
        })
      );
    });
  });

  describe('Batch Renewal Processing', () => {
    it('should allow selection of multiple renewals', async () => {
      renderComponent();
      
      await waitFor(() => {
        const selectAll = screen.getByLabelText(/select all renewals/i);
        fireEvent.click(selectAll);
      });

      await waitFor(() => {
        expect(screen.getByTestId('bulk-actions')).toBeInTheDocument();
        expect(screen.getByText('2 renewals selected')).toBeInTheDocument();
      });
    });

    it('should process batch renewals', async () => {
      renderComponent();
      
      await waitFor(() => {
        const selectAll = screen.getByLabelText(/select all renewals/i);
        fireEvent.click(selectAll);
      });

      await waitFor(() => {
        const batchButton = screen.getByRole('button', { name: /process batch/i });
        fireEvent.click(batchButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('batch-processing')).toBeInTheDocument();
        expect(screen.getByText('Processing 2 renewals')).toBeInTheDocument();
      });
    });

    it('should apply bulk strategies', async () => {
      renderComponent();
      
      await waitFor(() => {
        const selectAll = screen.getByLabelText(/select all renewals/i);
        fireEvent.click(selectAll);
      });

      await waitFor(() => {
        const strategyButton = screen.getByRole('button', { name: /apply strategy/i });
        fireEvent.click(strategyButton);
      });

      expect(mockOnStrategyApplied).toHaveBeenCalledWith(
        expect.objectContaining({
          renewalIds: ['renewal1', 'renewal2'],
        })
      );
    });

    it('should export selected renewals', async () => {
      renderComponent();
      
      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /export/i });
        fireEvent.click(exportButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('export-options')).toBeInTheDocument();
        expect(screen.getByText('CSV')).toBeInTheDocument();
        expect(screen.getByText('Excel')).toBeInTheDocument();
      });
    });
  });

  describe('Renewal Analytics', () => {
    it('should display renewal metrics', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('renewal-metrics')).toBeInTheDocument();
        expect(screen.getByText('Renewal Rate')).toBeInTheDocument();
        expect(screen.getByText('82%')).toBeInTheDocument();
      });
    });

    it('should show cost savings achieved', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('cost-savings')).toBeInTheDocument();
        expect(screen.getByText('$125,000')).toBeInTheDocument();
        expect(screen.getByText('Savings Achieved')).toBeInTheDocument();
      });
    });

    it('should display monthly trends', async () => {
      renderComponent({ view: 'analytics' });
      
      await waitFor(() => {
        expect(screen.getByTestId('monthly-trends')).toBeInTheDocument();
        expect(screen.getByText('Monthly Renewal Trends')).toBeInTheDocument();
      });
    });

    it('should show risk distribution', async () => {
      renderComponent({ view: 'analytics' });
      
      await waitFor(() => {
        expect(screen.getByTestId('risk-distribution')).toBeInTheDocument();
        expect(screen.getByText('Low Risk: 25')).toBeInTheDocument();
        expect(screen.getByText('High Risk: 5')).toBeInTheDocument();
      });
    });

    it('should generate analytics reports', async () => {
      renderComponent({ view: 'analytics' });
      
      await waitFor(() => {
        const reportButton = screen.getByRole('button', { name: /generate report/i });
        fireEvent.click(reportButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('report-generation')).toBeInTheDocument();
        expect(screen.getByText('Renewal Analytics Report')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle renewal loading errors', async () => {
      const mockApi = vi.mocked(api);
      mockApi.get.mockRejectedValueOnce(new Error('Failed to load renewals'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load renewals/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should validate renewal updates', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal1 = screen.getByTestId('renewal-renewal1');
        const updateButton = within(renewal1).getByRole('button', { name: /update/i });
        fireEvent.click(updateButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/please complete required fields/i)).toBeInTheDocument();
      });
    });

    it('should show loading states', () => {
      renderComponent();
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText(/loading renewals/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Renewal Management Platform');
        expect(screen.getByRole('region', { name: /analytics dashboard/i })).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const firstRenewal = screen.getByTestId('renewal-renewal1');
        firstRenewal.focus();
        
        user.keyboard('{Enter}');
      });

      await waitFor(() => {
        expect(screen.getByTestId('renewal-details-renewal1')).toBeInTheDocument();
      });
    });

    it('should announce updates', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewal1 = screen.getByTestId('renewal-renewal1');
        const updateButton = within(renewal1).getByRole('button', { name: /mark reviewed/i });
        fireEvent.click(updateButton);
      });

      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/renewal status updated/i);
      });
    });
  });

  describe('Integration Features', () => {
    it('should filter renewals by search', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search renewals/i);
        user.type(searchInput, 'software');
      });

      await waitFor(() => {
        const renewals = screen.getAllByTestId(/^renewal-/);
        expect(renewals).toHaveLength(1);
        expect(screen.getByText('Software License Agreement')).toBeInTheDocument();
      });
    });

    it('should filter by status', async () => {
      renderComponent();
      
      await waitFor(() => {
        const statusFilter = screen.getByLabelText(/filter by status/i);
        fireEvent.change(statusFilter, { target: { value: 'review_required' } });
      });

      await waitFor(() => {
        const renewals = screen.getAllByTestId(/^renewal-/);
        expect(renewals).toHaveLength(1);
        expect(screen.getByText('Maintenance Services')).toBeInTheDocument();
      });
    });

    it('should sort renewals', async () => {
      renderComponent();
      
      await waitFor(() => {
        const sortSelect = screen.getByLabelText(/sort by/i);
        fireEvent.change(sortSelect, { target: { value: 'value_desc' } });
      });

      await waitFor(() => {
        const renewals = screen.getAllByTestId(/^renewal-/);
        expect(within(renewals[0]).getByText('Software License Agreement')).toBeInTheDocument();
      });
    });
  });
});