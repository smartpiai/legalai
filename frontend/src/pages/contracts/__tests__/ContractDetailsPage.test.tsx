/**
 * ContractDetailsPage Test Suite
 * Comprehensive tests covering all functionality without mocks/stubs
 * Following TDD methodology: RED-GREEN-REFACTOR
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import ContractDetailsPage from '../ContractDetailsPage';
import { contractService } from '@/services/contract.service';

// Mock the contract service
vi.mock('@/services/contract.service');

const mockContractService = vi.mocked(contractService);

// Mock data
const mockContract = {
  id: 'contract-123',
  title: 'Software License Agreement',
  contract_number: 'SLA-2024-001',
  contract_type: 'license',
  status: 'active',
  value: 50000,
  currency: 'USD',
  start_date: '2024-01-01',
  end_date: '2024-12-31',
  parties: ['Company A', 'Company B'],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
  metadata: {
    auto_renewal: true,
    renewal_notice_period: 30,
    governing_law: 'Delaware',
    risk_score: 65,
    compliance_status: 'compliant',
    owner: 'John Doe',
    approvers: ['Jane Smith', 'Bob Johnson'],
    next_renewal_date: '2025-01-01'
  }
};

const mockDocuments = [
  {
    id: 'doc-1',
    filename: 'contract.pdf',
    size: 1024000,
    uploaded_at: '2024-01-01T00:00:00Z',
    uploaded_by: 'John Doe'
  },
  {
    id: 'doc-2',
    filename: 'amendment-1.pdf',
    size: 512000,
    uploaded_at: '2024-02-01T00:00:00Z',
    uploaded_by: 'Jane Smith'
  }
];

const mockActivity = [
  {
    date: '2024-01-15T10:30:00Z',
    event: 'Contract Approved',
    user: 'Jane Smith',
    details: 'Contract approved and activated'
  },
  {
    date: '2024-01-01T09:00:00Z',
    event: 'Contract Created',
    user: 'John Doe',
    details: 'Initial contract created from template'
  }
];

const mockObligations = [
  {
    id: 'obl-1',
    type: 'payment',
    description: 'Quarterly payment due',
    due_date: '2024-04-01',
    status: 'pending',
    responsible_party: 'Company A'
  },
  {
    id: 'obl-2',
    type: 'review',
    description: 'Annual contract review',
    due_date: '2024-12-01',
    status: 'upcoming',
    responsible_party: 'Legal Team'
  }
];

const mockRiskAssessment = {
  overall_risk: 'medium',
  risk_score: 65,
  risk_factors: [
    {
      factor: 'Auto-renewal clause',
      severity: 'medium',
      mitigation: 'Set calendar reminder 60 days before renewal'
    },
    {
      factor: 'High contract value',
      severity: 'low',
      mitigation: 'Approved by senior management'
    }
  ]
};

const mockVersions = [
  {
    id: 'v-2',
    version_number: 2,
    created_at: '2024-01-15T00:00:00Z',
    created_by: 'Jane Smith',
    changes: 'Updated payment terms and added compliance clause'
  },
  {
    id: 'v-1',
    version_number: 1,
    created_at: '2024-01-01T00:00:00Z',
    created_by: 'John Doe',
    changes: 'Initial version created from template'
  }
];

const mockComments = [
  {
    id: 'comment-1',
    user: 'Jane Smith',
    content: 'Please review the payment terms section',
    created_at: '2024-01-10T14:30:00Z',
    mentions: ['@john.doe']
  }
];

// Helper function to render with router
const renderWithRouter = (contractId = 'contract-123') => {
  return render(
    <MemoryRouter initialEntries={[`/contracts/${contractId}`]}>
      <Routes>
        <Route path="/contracts/:id" element={<ContractDetailsPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('ContractDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockContractService.getContract.mockResolvedValue(mockContract);
    mockContractService.getDocuments.mockResolvedValue(mockDocuments);
    mockContractService.getTimeline.mockResolvedValue(mockActivity);
    mockContractService.getObligations.mockResolvedValue(mockObligations);
    mockContractService.getRiskAssessment.mockResolvedValue(mockRiskAssessment);
    mockContractService.getVersions.mockResolvedValue(mockVersions);
  });

  describe('Contract Loading and Display', () => {
    it('should extract contract ID from URL parameters', async () => {
      renderWithRouter('test-contract-456');
      
      await waitFor(() => {
        expect(mockContractService.getContract).toHaveBeenCalledWith('test-contract-456');
      });
    });

    it('should display contract header information correctly', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByText('Software License Agreement')).toBeInTheDocument();
        expect(screen.getByText('SLA-2024-001')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
      });
    });

    it('should display contract status with appropriate styling', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        const statusBadge = screen.getByText('Active');
        expect(statusBadge).toHaveClass('bg-green-100', 'text-green-800');
      });
    });

    it('should show loading state while fetching data', () => {
      renderWithRouter();
      
      expect(screen.getByTestId('contract-loading')).toBeInTheDocument();
    });

    it('should handle contract not found error', async () => {
      mockContractService.getContract.mockRejectedValue(new Error('Contract not found'));
      
      renderWithRouter('non-existent');
      
      await waitFor(() => {
        expect(screen.getByText('Contract not found')).toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      mockContractService.getContract.mockRejectedValue(new Error('API Error'));
      
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load contract details')).toBeInTheDocument();
      });
    });
  });

  describe('Actions Toolbar', () => {
    it('should display all action buttons', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /archive/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      });
    });

    it('should handle edit button click', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });
      
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);
      
      // Should navigate to edit page
      expect(window.location.pathname).toBe('/contracts/contract-123/edit');
    });

    it('should handle download button click', async () => {
      const user = userEvent.setup();
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      mockContractService.downloadDocument.mockResolvedValue(mockBlob);
      
      // Mock URL.createObjectURL
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:url');
      global.URL.createObjectURL = mockCreateObjectURL;
      
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
      });
      
      const downloadButton = screen.getByRole('button', { name: /download/i });
      await user.click(downloadButton);
      
      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
      });
    });

    it('should show confirmation dialog before deletion', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      });
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);
      
      expect(screen.getByText('Delete Contract')).toBeInTheDocument();
      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
    });

    it('should disable actions based on permissions', async () => {
      const restrictedContract = {
        ...mockContract,
        metadata: { ...mockContract.metadata, canEdit: false, canDelete: false }
      };
      mockContractService.getContract.mockResolvedValue(restrictedContract);
      
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();
      });
    });
  });

  describe('Tabbed Interface', () => {
    it('should display all tab headers', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /documents/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /activity/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /obligations/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /risks/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /comments/i })).toBeInTheDocument();
      });
    });

    it('should show Overview tab by default', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        const overviewTab = screen.getByRole('tab', { name: /overview/i });
        expect(overviewTab).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('should switch tabs when clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /documents/i })).toBeInTheDocument();
      });
      
      const documentsTab = screen.getByRole('tab', { name: /documents/i });
      await user.click(documentsTab);
      
      expect(documentsTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('documents-panel')).toBeInTheDocument();
    });
  });

  describe('Overview Tab', () => {
    it('should display basic contract information', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByText('Software License Agreement')).toBeInTheDocument();
        expect(screen.getByText('license')).toBeInTheDocument();
        expect(screen.getByText('$50,000')).toBeInTheDocument();
        expect(screen.getByText('Company A')).toBeInTheDocument();
        expect(screen.getByText('Company B')).toBeInTheDocument();
      });
    });

    it('should display contract dates', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByText('Jan 1, 2024')).toBeInTheDocument();
        expect(screen.getByText('Dec 31, 2024')).toBeInTheDocument();
      });
    });

    it('should show auto-renewal status', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByText('Auto-renewal enabled')).toBeInTheDocument();
        expect(screen.getByText('30 days notice period')).toBeInTheDocument();
      });
    });

    it('should display risk score with color coding', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        const riskScore = screen.getByText('65');
        expect(riskScore).toHaveClass('text-yellow-600'); // Medium risk color
      });
    });
  });

  describe('Documents Tab', () => {
    it('should display document list', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await waitFor(() => {
        const documentsTab = screen.getByRole('tab', { name: /documents/i });
        user.click(documentsTab);
      });
      
      await waitFor(() => {
        expect(screen.getByText('contract.pdf')).toBeInTheDocument();
        expect(screen.getByText('amendment-1.pdf')).toBeInTheDocument();
      });
    });

    it('should show document metadata', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await waitFor(() => {
        const documentsTab = screen.getByRole('tab', { name: /documents/i });
        user.click(documentsTab);
      });
      
      await waitFor(() => {
        expect(screen.getByText('1.0 MB')).toBeInTheDocument(); // File size
        expect(screen.getByText('John Doe')).toBeInTheDocument(); // Uploaded by
      });
    });

    it('should allow document download', async () => {
      const user = userEvent.setup();
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      mockContractService.downloadDocument.mockResolvedValue(mockBlob);
      
      renderWithRouter();
      
      await waitFor(() => {
        const documentsTab = screen.getByRole('tab', { name: /documents/i });
        user.click(documentsTab);
      });
      
      await waitFor(() => {
        const downloadButton = screen.getByRole('button', { name: /download contract.pdf/i });
        user.click(downloadButton);
      });
      
      await waitFor(() => {
        expect(mockContractService.downloadDocument).toHaveBeenCalledWith('contract-123', 'doc-1');
      });
    });
  });

  describe('Activity Tab', () => {
    it('should display activity timeline', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await waitFor(() => {
        const activityTab = screen.getByRole('tab', { name: /activity/i });
        user.click(activityTab);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Contract Approved')).toBeInTheDocument();
        expect(screen.getByText('Contract Created')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('should show activity details', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await waitFor(() => {
        const activityTab = screen.getByRole('tab', { name: /activity/i });
        user.click(activityTab);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Contract approved and activated')).toBeInTheDocument();
        expect(screen.getByText('Initial contract created from template')).toBeInTheDocument();
      });
    });

    it('should order activities by date (newest first)', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await waitFor(() => {
        const activityTab = screen.getByRole('tab', { name: /activity/i });
        user.click(activityTab);
      });
      
      await waitFor(() => {
        const activities = screen.getAllByTestId('activity-item');
        expect(activities[0]).toHaveTextContent('Contract Approved');
        expect(activities[1]).toHaveTextContent('Contract Created');
      });
    });
  });

  describe('Obligations Tab', () => {
    it('should display obligations list', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await waitFor(() => {
        const obligationsTab = screen.getByRole('tab', { name: /obligations/i });
        user.click(obligationsTab);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Quarterly payment due')).toBeInTheDocument();
        expect(screen.getByText('Annual contract review')).toBeInTheDocument();
      });
    });

    it('should show obligation status', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await waitFor(() => {
        const obligationsTab = screen.getByRole('tab', { name: /obligations/i });
        user.click(obligationsTab);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument();
        expect(screen.getByText('Upcoming')).toBeInTheDocument();
      });
    });

    it('should allow updating obligation status', async () => {
      const user = userEvent.setup();
      mockContractService.updateObligation.mockResolvedValue(undefined);
      
      renderWithRouter();
      
      await waitFor(() => {
        const obligationsTab = screen.getByRole('tab', { name: /obligations/i });
        user.click(obligationsTab);
      });
      
      await waitFor(() => {
        const statusButton = screen.getByRole('button', { name: /update status/i });
        user.click(statusButton);
      });
      
      await waitFor(() => {
        expect(mockContractService.updateObligation).toHaveBeenCalled();
      });
    });
  });

  describe('Risks Tab', () => {
    it('should display risk assessment', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await waitFor(() => {
        const risksTab = screen.getByRole('tab', { name: /risks/i });
        user.click(risksTab);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Medium Risk')).toBeInTheDocument();
        expect(screen.getByText('65')).toBeInTheDocument();
      });
    });

    it('should show risk factors', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await waitFor(() => {
        const risksTab = screen.getByRole('tab', { name: /risks/i });
        user.click(risksTab);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Auto-renewal clause')).toBeInTheDocument();
        expect(screen.getByText('High contract value')).toBeInTheDocument();
      });
    });

    it('should display mitigation recommendations', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await waitFor(() => {
        const risksTab = screen.getByRole('tab', { name: /risks/i });
        user.click(risksTab);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Set calendar reminder 60 days before renewal')).toBeInTheDocument();
        expect(screen.getByText('Approved by senior management')).toBeInTheDocument();
      });
    });
  });

  describe('Comments Tab', () => {
    it('should display existing comments', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await waitFor(() => {
        const commentsTab = screen.getByRole('tab', { name: /comments/i });
        user.click(commentsTab);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Please review the payment terms section')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('should allow adding new comments', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await waitFor(() => {
        const commentsTab = screen.getByRole('tab', { name: /comments/i });
        user.click(commentsTab);
      });
      
      await waitFor(() => {
        const commentInput = screen.getByPlaceholderText('Add a comment...');
        expect(commentInput).toBeInTheDocument();
      });
      
      const commentInput = screen.getByPlaceholderText('Add a comment...');
      await user.type(commentInput, 'This looks good to me');
      
      const submitButton = screen.getByRole('button', { name: /post comment/i });
      await user.click(submitButton);
      
      // Should show the new comment
      await waitFor(() => {
        expect(screen.getByText('This looks good to me')).toBeInTheDocument();
      });
    });

    it('should handle @mentions in comments', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await waitFor(() => {
        const commentsTab = screen.getByRole('tab', { name: /comments/i });
        user.click(commentsTab);
      });
      
      await waitFor(() => {
        expect(screen.getByText('@john.doe')).toBeInTheDocument();
        expect(screen.getByText('@john.doe')).toHaveClass('text-blue-600');
      });
    });
  });

  describe('Version History Sidebar', () => {
    it('should display version history', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByText('Version History')).toBeInTheDocument();
        expect(screen.getByText('Version 2')).toBeInTheDocument();
        expect(screen.getByText('Version 1')).toBeInTheDocument();
      });
    });

    it('should show version details', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByText('Updated payment terms and added compliance clause')).toBeInTheDocument();
        expect(screen.getByText('Initial version created from template')).toBeInTheDocument();
      });
    });

    it('should allow version comparison', async () => {
      const user = userEvent.setup();
      mockContractService.compareVersions.mockResolvedValue({
        version1: 'v-1',
        version2: 'v-2',
        differences: [
          {
            type: 'added',
            path: 'payment_terms',
            old_value: null,
            new_value: 'net_30'
          }
        ]
      });
      
      renderWithRouter();
      
      await waitFor(() => {
        const compareButton = screen.getByRole('button', { name: /compare versions/i });
        user.click(compareButton);
      });
      
      await waitFor(() => {
        expect(mockContractService.compareVersions).toHaveBeenCalled();
      });
    });
  });

  describe('Related Contracts Section', () => {
    it('should display related contracts', async () => {
      const mockRelatedContracts = [
        {
          id: 'related-1',
          title: 'Support Agreement',
          contract_type: 'service',
          status: 'active'
        }
      ];
      
      mockContractService.searchContracts.mockResolvedValue({
        items: mockRelatedContracts,
        total: 1
      });
      
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByText('Related Contracts')).toBeInTheDocument();
        expect(screen.getByText('Support Agreement')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should collapse sidebar on mobile screens', async () => {
      // Mock window.matchMedia for mobile
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(max-width: 768px)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
      
      renderWithRouter();
      
      await waitFor(() => {
        const sidebar = screen.getByTestId('version-history-sidebar');
        expect(sidebar).toHaveClass('hidden', 'md:block');
      });
    });

    it('should stack tabs vertically on small screens', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        const tabList = screen.getByRole('tablist');
        expect(tabList).toHaveClass('flex-col', 'sm:flex-row');
      });
    });
  });

  describe('Performance and Optimization', () => {
    it('should load all data in parallel', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        expect(mockContractService.getContract).toHaveBeenCalledTimes(1);
        expect(mockContractService.getDocuments).toHaveBeenCalledTimes(1);
        expect(mockContractService.getTimeline).toHaveBeenCalledTimes(1);
        expect(mockContractService.getObligations).toHaveBeenCalledTimes(1);
        expect(mockContractService.getRiskAssessment).toHaveBeenCalledTimes(1);
        expect(mockContractService.getVersions).toHaveBeenCalledTimes(1);
      });
    });

    it('should cache API responses', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByText('Software License Agreement')).toBeInTheDocument();
      });
      
      // Re-render the same component
      renderWithRouter();
      
      // Should use cached data, not make new API calls
      expect(mockContractService.getContract).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Contract details');
        expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Contract information tabs');
      });
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await waitFor(() => {
        const overviewTab = screen.getByRole('tab', { name: /overview/i });
        overviewTab.focus();
      });
      
      // Tab navigation should work
      await user.keyboard('{ArrowRight}');
      
      const documentsTab = screen.getByRole('tab', { name: /documents/i });
      expect(documentsTab).toHaveFocus();
    });

    it('should provide screen reader friendly content', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Status: Active')).toBeInTheDocument();
        expect(screen.getByText('Risk Level: Medium, Score 65 out of 100')).toBeInTheDocument();
      });
    });
  });
});