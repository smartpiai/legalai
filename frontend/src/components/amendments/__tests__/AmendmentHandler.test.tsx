import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AmendmentHandler } from '../AmendmentHandler';
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
      permissions: ['view_amendments', 'create_amendments', 'approve_amendments'],
    },
  }),
}));

describe('AmendmentHandler', () => {
  let queryClient: QueryClient;
  const mockOnAmendmentCreated = vi.fn();
  const mockOnAmendmentApproved = vi.fn();
  const mockOnBulkUpdate = vi.fn();

  const mockAmendments = [
    {
      id: 'amendment1',
      contractId: 'contract1',
      parentContractName: 'Master Service Agreement',
      type: 'scope_change',
      title: 'Scope Extension Amendment',
      description: 'Extending service scope to include additional regions',
      status: 'draft',
      version: '1.0',
      requestedBy: 'Jane Smith',
      requestedDate: '2024-01-15T10:00:00Z',
      effectiveDate: '2024-02-01T00:00:00Z',
      changes: [
        {
          id: 'change1',
          section: 'Section 3.1',
          original: 'Services limited to North America',
          amended: 'Services extended to North America and Europe',
          type: 'modification',
          impact: 'high',
        },
        {
          id: 'change2',
          section: 'Section 5.2',
          original: '$100,000 monthly fee',
          amended: '$150,000 monthly fee',
          type: 'modification',
          impact: 'high',
        },
      ],
      impactAnalysis: {
        financial: 'Increase of $50,000 monthly revenue',
        operational: 'Requires EU compliance team',
        legal: 'GDPR compliance required',
        risk: 'medium',
      },
      approvalChain: [
        {
          id: 'approval1',
          approver: 'Legal Team',
          status: 'approved',
          date: '2024-01-20T14:00:00Z',
          comments: 'Legal review complete',
        },
        {
          id: 'approval2',
          approver: 'Finance Team',
          status: 'pending',
          date: null,
          comments: null,
        },
      ],
      documents: [
        {
          id: 'doc1',
          name: 'Amendment Draft.pdf',
          type: 'amendment',
          uploadedAt: '2024-01-15T10:30:00Z',
        },
      ],
      history: [
        {
          id: 'history1',
          action: 'created',
          user: 'Jane Smith',
          date: '2024-01-15T10:00:00Z',
          details: 'Amendment created',
        },
      ],
      consolidatedView: null,
      notificationsSent: ['legal@company.com'],
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-20T14:00:00Z',
    },
    {
      id: 'amendment2',
      contractId: 'contract2',
      parentContractName: 'Software License Agreement',
      type: 'term_extension',
      title: 'Term Extension Amendment',
      description: 'Extending contract term by 2 years',
      status: 'under_review',
      version: '2.0',
      requestedBy: 'Bob Johnson',
      requestedDate: '2024-01-10T09:00:00Z',
      effectiveDate: '2024-03-01T00:00:00Z',
      changes: [
        {
          id: 'change3',
          section: 'Section 2.1',
          original: 'Term ends December 31, 2024',
          amended: 'Term ends December 31, 2026',
          type: 'modification',
          impact: 'medium',
        },
      ],
      impactAnalysis: {
        financial: 'Locked-in pricing for 2 additional years',
        operational: 'Continued service without re-procurement',
        legal: 'Auto-renewal clause activated',
        risk: 'low',
      },
      approvalChain: [
        {
          id: 'approval3',
          approver: 'Procurement',
          status: 'approved',
          date: '2024-01-12T11:00:00Z',
          comments: 'Cost savings confirmed',
        },
      ],
      documents: [],
      history: [],
      consolidatedView: 'consolidated-contract-v2.pdf',
      notificationsSent: ['procurement@company.com', 'legal@company.com'],
      createdAt: '2024-01-10T09:00:00Z',
      updatedAt: '2024-01-12T11:00:00Z',
    },
  ];

  const mockTemplates = [
    {
      id: 'template1',
      name: 'Standard Scope Change',
      type: 'scope_change',
      fields: ['scope_description', 'impact_assessment', 'cost_adjustment'],
    },
    {
      id: 'template2',
      name: 'Term Extension',
      type: 'term_extension',
      fields: ['extension_period', 'renewal_terms', 'notice_period'],
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
      if (url.includes('/amendments')) {
        return Promise.resolve({ data: mockAmendments });
      }
      if (url.includes('/amendment-templates')) {
        return Promise.resolve({ data: mockTemplates });
      }
      if (url.includes('/contracts')) {
        return Promise.resolve({ 
          data: [
            { id: 'contract1', name: 'Master Service Agreement' },
            { id: 'contract2', name: 'Software License Agreement' },
          ]
        });
      }
      return Promise.resolve({ data: [] });
    });

    mockApi.post.mockResolvedValue({ 
      data: { 
        id: 'new-amendment',
        ...mockAmendments[0],
        status: 'draft'
      } 
    });

    mockApi.put.mockResolvedValue({ 
      data: { 
        ...mockAmendments[0],
        status: 'approved'
      } 
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AmendmentHandler
          onAmendmentCreated={mockOnAmendmentCreated}
          onAmendmentApproved={mockOnAmendmentApproved}
          onBulkUpdate={mockOnBulkUpdate}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  describe('Initial Render', () => {
    it('should render the amendment handler interface', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('amendment-handler')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /amendment handler/i })).toBeInTheDocument();
      });
    });

    it('should display amendment list', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('amendments-list')).toBeInTheDocument();
        expect(screen.getByText('Scope Extension Amendment')).toBeInTheDocument();
        expect(screen.getByText('Term Extension Amendment')).toBeInTheDocument();
      });
    });

    it('should show amendment filters', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('amendment-filters')).toBeInTheDocument();
        expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/filter by type/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/search amendments/i)).toBeInTheDocument();
      });
    });

    it('should display create amendment button', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create amendment/i })).toBeInTheDocument();
      });
    });
  });

  describe('Amendment Request Workflow', () => {
    it('should open amendment request form', async () => {
      renderComponent();
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create amendment/i });
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('amendment-request-form')).toBeInTheDocument();
        expect(screen.getByLabelText(/amendment title/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/amendment type/i)).toBeInTheDocument();
      });
    });

    it('should validate required fields', async () => {
      renderComponent();
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create amendment/i });
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit amendment/i });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
        expect(screen.getByText(/type is required/i)).toBeInTheDocument();
      });
    });

    it('should submit amendment request', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create amendment/i });
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        user.type(screen.getByLabelText(/amendment title/i), 'New Amendment');
        user.selectOptions(screen.getByLabelText(/amendment type/i), 'scope_change');
        user.type(screen.getByLabelText(/description/i), 'Amendment description');
      });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit amendment/i });
        fireEvent.click(submitButton);
      });

      expect(mockOnAmendmentCreated).toHaveBeenCalled();
    });

    it('should use amendment templates', async () => {
      renderComponent();
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create amendment/i });
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        const templateSelect = screen.getByLabelText(/use template/i);
        fireEvent.change(templateSelect, { target: { value: 'template1' } });
      });

      await waitFor(() => {
        expect(screen.getByTestId('template-fields')).toBeInTheDocument();
        expect(screen.getByLabelText(/scope description/i)).toBeInTheDocument();
      });
    });
  });

  describe('Parent Contract Linking', () => {
    it('should display parent contract information', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        expect(within(amendment1).getByText('Master Service Agreement')).toBeInTheDocument();
        expect(within(amendment1).getByTestId('parent-link')).toBeInTheDocument();
      });
    });

    it('should link to parent contract', async () => {
      renderComponent();
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create amendment/i });
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/parent contract/i)).toBeInTheDocument();
        const contractSelect = screen.getByLabelText(/parent contract/i);
        expect(contractSelect.children.length).toBeGreaterThan(0);
      });
    });

    it('should show contract hierarchy', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        fireEvent.click(within(amendment1).getByRole('button', { name: /view hierarchy/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('contract-hierarchy')).toBeInTheDocument();
        expect(screen.getByText('Contract Hierarchy')).toBeInTheDocument();
      });
    });

    it('should inherit parent contract metadata', async () => {
      renderComponent();
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create amendment/i });
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        const contractSelect = screen.getByLabelText(/parent contract/i);
        fireEvent.change(contractSelect, { target: { value: 'contract1' } });
      });

      await waitFor(() => {
        expect(screen.getByTestId('inherited-metadata')).toBeInTheDocument();
      });
    });
  });

  describe('Change Impact Analysis', () => {
    it('should display change details', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        expect(within(amendment1).getByText('2 changes')).toBeInTheDocument();
        fireEvent.click(within(amendment1).getByRole('button', { name: /view changes/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('change-details')).toBeInTheDocument();
        expect(screen.getByText('Section 3.1')).toBeInTheDocument();
        expect(screen.getByText('Section 5.2')).toBeInTheDocument();
      });
    });

    it('should show impact analysis', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        fireEvent.click(within(amendment1).getByRole('button', { name: /impact analysis/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('impact-analysis')).toBeInTheDocument();
        expect(screen.getByText(/financial impact/i)).toBeInTheDocument();
        expect(screen.getByText(/\$50,000 monthly revenue/i)).toBeInTheDocument();
      });
    });

    it('should categorize impact levels', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        const impactBadge = within(amendment1).getByTestId('impact-badge');
        expect(impactBadge).toHaveTextContent('Medium Risk');
      });
    });

    it('should allow adding change items', async () => {
      renderComponent();
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create amendment/i });
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        const addChangeButton = screen.getByRole('button', { name: /add change/i });
        fireEvent.click(addChangeButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('change-form')).toBeInTheDocument();
        expect(screen.getByLabelText(/section/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/original text/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/amended text/i)).toBeInTheDocument();
      });
    });
  });

  describe('Version Control System', () => {
    it('should display version information', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        expect(within(amendment1).getByText('v1.0')).toBeInTheDocument();
      });
    });

    it('should track version history', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        fireEvent.click(within(amendment1).getByRole('button', { name: /version history/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('version-history')).toBeInTheDocument();
        expect(screen.getByText('Version History')).toBeInTheDocument();
      });
    });

    it('should create new version', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        fireEvent.click(within(amendment1).getByRole('button', { name: /new version/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('version-dialog')).toBeInTheDocument();
        expect(screen.getByLabelText(/version notes/i)).toBeInTheDocument();
      });
    });

    it('should compare versions', async () => {
      renderComponent();
      
      await waitFor(() => {
        const compareButton = screen.getByRole('button', { name: /compare versions/i });
        fireEvent.click(compareButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('version-comparison')).toBeInTheDocument();
      });
    });
  });

  describe('Amendment Approval Chain', () => {
    it('should display approval status', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        expect(within(amendment1).getByTestId('approval-status')).toBeInTheDocument();
        expect(within(amendment1).getByText('1/2 Approved')).toBeInTheDocument();
      });
    });

    it('should show approval chain details', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        fireEvent.click(within(amendment1).getByRole('button', { name: /approval chain/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('approval-chain')).toBeInTheDocument();
        expect(screen.getByText('Legal Team')).toBeInTheDocument();
        expect(screen.getByText('Finance Team')).toBeInTheDocument();
      });
    });

    it('should allow approval actions', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        const approveButton = within(amendment1).getByRole('button', { name: /approve/i });
        fireEvent.click(approveButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('approval-dialog')).toBeInTheDocument();
        expect(screen.getByLabelText(/approval comments/i)).toBeInTheDocument();
      });
    });

    it('should handle rejection with reasons', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        const rejectButton = within(amendment1).getByRole('button', { name: /reject/i });
        fireEvent.click(rejectButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('rejection-dialog')).toBeInTheDocument();
        expect(screen.getByLabelText(/rejection reason/i)).toBeInTheDocument();
      });
    });
  });

  describe('Consolidated View Generation', () => {
    it('should generate consolidated view', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        const generateButton = within(amendment1).getByRole('button', { name: /generate consolidated/i });
        fireEvent.click(generateButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('consolidation-progress')).toBeInTheDocument();
      });
    });

    it('should display existing consolidated view', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment2 = screen.getByTestId('amendment-amendment2');
        expect(within(amendment2).getByTestId('consolidated-link')).toBeInTheDocument();
        expect(within(amendment2).getByText('View Consolidated')).toBeInTheDocument();
      });
    });

    it('should preview consolidated changes', async () => {
      renderComponent();
      
      await waitFor(() => {
        const previewButton = screen.getByRole('button', { name: /preview consolidated/i });
        fireEvent.click(previewButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('consolidated-preview')).toBeInTheDocument();
      });
    });

    it('should export consolidated document', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment2 = screen.getByTestId('amendment-amendment2');
        const exportButton = within(amendment2).getByRole('button', { name: /export/i });
        fireEvent.click(exportButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('export-options')).toBeInTheDocument();
        expect(screen.getByText('PDF')).toBeInTheDocument();
        expect(screen.getByText('Word')).toBeInTheDocument();
      });
    });
  });

  describe('Amendment History Tracking', () => {
    it('should display amendment history', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        fireEvent.click(within(amendment1).getByRole('button', { name: /view history/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('amendment-history')).toBeInTheDocument();
        expect(screen.getByText('Amendment created')).toBeInTheDocument();
      });
    });

    it('should track all actions', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        fireEvent.click(within(amendment1).getByRole('button', { name: /activity log/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('activity-log')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('should show timeline view', async () => {
      renderComponent({ view: 'timeline' });
      
      await waitFor(() => {
        expect(screen.getByTestId('amendment-timeline')).toBeInTheDocument();
        expect(screen.getByText(/january 2024/i)).toBeInTheDocument();
      });
    });

    it('should filter history by action type', async () => {
      renderComponent();
      
      await waitFor(() => {
        const filterSelect = screen.getByLabelText(/filter by action/i);
        fireEvent.change(filterSelect, { target: { value: 'approval' } });
      });

      await waitFor(() => {
        expect(screen.getByTestId('filtered-history')).toBeInTheDocument();
      });
    });
  });

  describe('Bulk Amendment Capabilities', () => {
    it('should allow selecting multiple amendments', async () => {
      renderComponent();
      
      await waitFor(() => {
        const selectAll = screen.getByLabelText(/select all/i);
        fireEvent.click(selectAll);
      });

      await waitFor(() => {
        expect(screen.getByTestId('bulk-actions')).toBeInTheDocument();
        expect(screen.getByText('2 amendments selected')).toBeInTheDocument();
      });
    });

    it('should process bulk approval', async () => {
      renderComponent();
      
      await waitFor(() => {
        const selectAll = screen.getByLabelText(/select all/i);
        fireEvent.click(selectAll);
      });

      await waitFor(() => {
        const bulkApprove = screen.getByRole('button', { name: /bulk approve/i });
        fireEvent.click(bulkApprove);
      });

      expect(mockOnBulkUpdate).toHaveBeenCalled();
    });

    it('should bulk update status', async () => {
      renderComponent();
      
      await waitFor(() => {
        const selectAll = screen.getByLabelText(/select all/i);
        fireEvent.click(selectAll);
      });

      await waitFor(() => {
        const bulkStatus = screen.getByRole('button', { name: /update status/i });
        fireEvent.click(bulkStatus);
      });

      await waitFor(() => {
        expect(screen.getByTestId('bulk-status-dialog')).toBeInTheDocument();
      });
    });

    it('should export selected amendments', async () => {
      renderComponent();
      
      await waitFor(() => {
        const selectAll = screen.getByLabelText(/select all/i);
        fireEvent.click(selectAll);
      });

      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /export selected/i });
        fireEvent.click(exportButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('export-dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Amendment Notification System', () => {
    it('should display notification status', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        expect(within(amendment1).getByTestId('notification-badge')).toBeInTheDocument();
      });
    });

    it('should send notifications', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        const notifyButton = within(amendment1).getByRole('button', { name: /send notification/i });
        fireEvent.click(notifyButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('notification-dialog')).toBeInTheDocument();
        expect(screen.getByLabelText(/recipients/i)).toBeInTheDocument();
      });
    });

    it('should show notification history', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        fireEvent.click(within(amendment1).getByRole('button', { name: /notification history/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('notification-history')).toBeInTheDocument();
        expect(screen.getByText('legal@company.com')).toBeInTheDocument();
      });
    });

    it('should configure notification preferences', async () => {
      renderComponent();
      
      await waitFor(() => {
        const settingsButton = screen.getByRole('button', { name: /notification settings/i });
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('notification-settings')).toBeInTheDocument();
        expect(screen.getByLabelText(/email notifications/i)).toBeInTheDocument();
      });
    });
  });

  describe('Legal Review Triggers', () => {
    it('should identify legal review requirements', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        expect(within(amendment1).getByTestId('legal-review-badge')).toBeInTheDocument();
      });
    });

    it('should trigger legal review', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        const reviewButton = within(amendment1).getByRole('button', { name: /request legal review/i });
        fireEvent.click(reviewButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('legal-review-dialog')).toBeInTheDocument();
        expect(screen.getByLabelText(/urgency/i)).toBeInTheDocument();
      });
    });

    it('should show review criteria', async () => {
      renderComponent();
      
      await waitFor(() => {
        const criteriaButton = screen.getByRole('button', { name: /review criteria/i });
        fireEvent.click(criteriaButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('review-criteria')).toBeInTheDocument();
        expect(screen.getByText(/high value changes/i)).toBeInTheDocument();
      });
    });

    it('should track legal review status', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        const statusBadge = within(amendment1).getByTestId('legal-status');
        expect(statusBadge).toHaveTextContent('Legal Approved');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle loading errors', async () => {
      const mockApi = vi.mocked(api);
      mockApi.get.mockRejectedValueOnce(new Error('Failed to load amendments'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load amendments/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should validate amendment submission', async () => {
      renderComponent();
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create amendment/i });
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit amendment/i });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/please complete required fields/i)).toBeInTheDocument();
      });
    });

    it('should show loading states', () => {
      renderComponent();
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText(/loading amendments/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Amendment Handler');
        expect(screen.getByRole('region', { name: /amendments list/i })).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const firstAmendment = screen.getByTestId('amendment-amendment1');
        firstAmendment.focus();
        user.keyboard('{Enter}');
      });

      await waitFor(() => {
        expect(screen.getByTestId('amendment-details-amendment1')).toBeInTheDocument();
      });
    });

    it('should announce updates', async () => {
      renderComponent();
      
      await waitFor(() => {
        const amendment1 = screen.getByTestId('amendment-amendment1');
        const updateButton = within(amendment1).getByRole('button', { name: /update status/i });
        fireEvent.click(updateButton);
      });

      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/amendment status updated/i);
      });
    });
  });

  describe('Integration Features', () => {
    it('should filter amendments by search', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search amendments/i);
        user.type(searchInput, 'scope');
      });

      await waitFor(() => {
        const amendments = screen.getAllByTestId(/^amendment-/);
        expect(amendments).toHaveLength(1);
        expect(screen.getByText('Scope Extension Amendment')).toBeInTheDocument();
      });
    });

    it('should filter by status', async () => {
      renderComponent();
      
      await waitFor(() => {
        const statusFilter = screen.getByLabelText(/filter by status/i);
        fireEvent.change(statusFilter, { target: { value: 'draft' } });
      });

      await waitFor(() => {
        const amendments = screen.getAllByTestId(/^amendment-/);
        expect(amendments).toHaveLength(1);
      });
    });

    it('should sort amendments', async () => {
      renderComponent();
      
      await waitFor(() => {
        const sortSelect = screen.getByLabelText(/sort by/i);
        fireEvent.change(sortSelect, { target: { value: 'date_desc' } });
      });

      await waitFor(() => {
        const amendments = screen.getAllByTestId(/^amendment-/);
        expect(within(amendments[0]).getByText('Scope Extension Amendment')).toBeInTheDocument();
      });
    });
  });
});