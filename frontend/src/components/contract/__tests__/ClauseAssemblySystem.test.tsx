import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClauseAssemblySystem } from '../ClauseAssemblySystem';
import { useAuthStore } from '../../../store/auth';

// Mock auth store
vi.mock('../../../store/auth', () => ({
  useAuthStore: vi.fn()
}));

// Mock API calls
const mockApi = {
  getClauses: vi.fn(),
  getClause: vi.fn(),
  getClauseDependencies: vi.fn(),
  checkConflicts: vi.fn(),
  getSuggestions: vi.fn(),
  optimizeOrder: vi.fn(),
  checkLegalReview: vi.fn(),
  getApprovalWorkflow: vi.fn(),
  saveAssembly: vi.fn(),
  getAssemblyHistory: vi.fn(),
  getUsageAnalytics: vi.fn(),
  checkPlaybookCompliance: vi.fn(),
  exportAssembly: vi.fn()
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('ClauseAssemblySystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as any).mockReturnValue({
      user: { id: '1', name: 'Test User', role: 'admin' },
      hasPermission: (perm: string) => true
    });
  });

  describe('Component Rendering', () => {
    it('should render clause assembly interface', () => {
      render(<ClauseAssemblySystem />, { wrapper });
      expect(screen.getByText('Clause Assembly System')).toBeInTheDocument();
      expect(screen.getByTestId('clause-library')).toBeInTheDocument();
      expect(screen.getByTestId('assembly-area')).toBeInTheDocument();
    });

    it('should display available clauses in library', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      await waitFor(() => {
        expect(screen.getByText('Payment Terms')).toBeInTheDocument();
        expect(screen.getByText('Confidentiality')).toBeInTheDocument();
        expect(screen.getByText('Termination')).toBeInTheDocument();
      });
    });

    it('should show clause search and filters', () => {
      render(<ClauseAssemblySystem />, { wrapper });
      expect(screen.getByPlaceholderText('Search clauses...')).toBeInTheDocument();
      expect(screen.getByLabelText('Category')).toBeInTheDocument();
      expect(screen.getByLabelText('Risk Level')).toBeInTheDocument();
    });
  });

  describe('Drag and Drop Builder', () => {
    it('should allow dragging clause from library', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const clause = screen.getByTestId('clause-payment-terms');
      expect(clause).toHaveAttribute('draggable', 'true');
    });

    it('should handle drop on assembly area', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const clause = screen.getByTestId('clause-payment-terms');
      const dropZone = screen.getByTestId('assembly-drop-zone');
      
      fireEvent.dragStart(clause);
      fireEvent.dragOver(dropZone);
      fireEvent.drop(dropZone);
      
      await waitFor(() => {
        expect(screen.getByText('Payment Terms added')).toBeInTheDocument();
      });
    });

    it('should reorder clauses via drag and drop', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const clause1 = screen.getByTestId('assembled-clause-1');
      const clause2 = screen.getByTestId('assembled-clause-2');
      
      fireEvent.dragStart(clause1);
      fireEvent.dragOver(clause2);
      fireEvent.drop(clause2);
      
      await waitFor(() => {
        expect(screen.getByText('Clauses reordered')).toBeInTheDocument();
      });
    });

    it('should show drop indicator while dragging', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const clause = screen.getByTestId('clause-payment-terms');
      const dropZone = screen.getByTestId('assembly-drop-zone');
      
      fireEvent.dragStart(clause);
      fireEvent.dragEnter(dropZone);
      
      expect(dropZone).toHaveClass('drop-active');
    });

    it('should remove clause from assembly', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const removeButton = screen.getByTestId('remove-clause-1');
      fireEvent.click(removeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Clause removed')).toBeInTheDocument();
      });
    });
  });

  describe('Clause Dependencies', () => {
    it('should detect clause dependencies', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const clause = screen.getByTestId('clause-indemnification');
      fireEvent.click(clause);
      
      await waitFor(() => {
        expect(screen.getByText('Requires: Limitation of Liability')).toBeInTheDocument();
      });
    });

    it('should auto-add required dependencies', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const clause = screen.getByTestId('clause-indemnification');
      const dropZone = screen.getByTestId('assembly-drop-zone');
      
      fireEvent.dragStart(clause);
      fireEvent.drop(dropZone);
      
      await waitFor(() => {
        expect(screen.getByText('Limitation of Liability added automatically')).toBeInTheDocument();
      });
    });

    it('should show dependency warnings', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const removeButton = screen.getByTestId('remove-clause-limitation');
      fireEvent.click(removeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Warning: Indemnification requires this clause')).toBeInTheDocument();
      });
    });

    it('should validate dependency chain', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const validateButton = screen.getByText('Validate Dependencies');
      fireEvent.click(validateButton);
      
      await waitFor(() => {
        expect(screen.getByText('All dependencies satisfied')).toBeInTheDocument();
      });
    });
  });

  describe('Conflict Detection', () => {
    it('should detect conflicting clauses', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const clause1 = screen.getByTestId('clause-exclusive-jurisdiction');
      const clause2 = screen.getByTestId('clause-arbitration');
      const dropZone = screen.getByTestId('assembly-drop-zone');
      
      fireEvent.dragStart(clause1);
      fireEvent.drop(dropZone);
      fireEvent.dragStart(clause2);
      fireEvent.drop(dropZone);
      
      await waitFor(() => {
        expect(screen.getByText('Conflict detected')).toBeInTheDocument();
        expect(screen.getByTestId('conflict-warning')).toBeInTheDocument();
      });
    });

    it('should show conflict resolution options', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const conflictWarning = screen.getByTestId('conflict-warning');
      fireEvent.click(conflictWarning);
      
      await waitFor(() => {
        expect(screen.getByText('Keep Exclusive Jurisdiction')).toBeInTheDocument();
        expect(screen.getByText('Keep Arbitration')).toBeInTheDocument();
        expect(screen.getByText('Merge Clauses')).toBeInTheDocument();
      });
    });

    it('should resolve conflicts based on selection', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const resolveButton = screen.getByText('Keep Arbitration');
      fireEvent.click(resolveButton);
      
      await waitFor(() => {
        expect(screen.getByText('Conflict resolved')).toBeInTheDocument();
        expect(screen.queryByTestId('clause-exclusive-jurisdiction')).not.toBeInTheDocument();
      });
    });

    it('should highlight conflicting clauses', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      await waitFor(() => {
        const conflictingClause1 = screen.getByTestId('assembled-clause-exclusive');
        const conflictingClause2 = screen.getByTestId('assembled-clause-arbitration');
        expect(conflictingClause1).toHaveClass('conflict-highlight');
        expect(conflictingClause2).toHaveClass('conflict-highlight');
      });
    });
  });

  describe('Alternative Suggestions', () => {
    it('should show alternative clause suggestions', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const clause = screen.getByTestId('assembled-clause-1');
      fireEvent.click(clause);
      
      await waitFor(() => {
        expect(screen.getByText('Alternative Clauses')).toBeInTheDocument();
        expect(screen.getByText('Standard Payment Terms')).toBeInTheDocument();
        expect(screen.getByText('Extended Payment Terms')).toBeInTheDocument();
      });
    });

    it('should compare alternative clauses', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const compareButton = screen.getByText('Compare Alternatives');
      fireEvent.click(compareButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('clause-comparison-modal')).toBeInTheDocument();
        expect(screen.getByText('Current vs Alternative')).toBeInTheDocument();
      });
    });

    it('should replace with alternative clause', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const alternativeClause = screen.getByTestId('alternative-clause-1');
      const useButton = within(alternativeClause).getByText('Use This');
      fireEvent.click(useButton);
      
      await waitFor(() => {
        expect(screen.getByText('Clause replaced')).toBeInTheDocument();
      });
    });

    it('should show risk level for alternatives', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const clause = screen.getByTestId('assembled-clause-1');
      fireEvent.click(clause);
      
      await waitFor(() => {
        expect(screen.getByText('Risk: Low')).toBeInTheDocument();
        expect(screen.getByText('Risk: Medium')).toBeInTheDocument();
      });
    });
  });

  describe('Clause Ordering', () => {
    it('should optimize clause order', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const optimizeButton = screen.getByText('Optimize Order');
      fireEvent.click(optimizeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Order optimized')).toBeInTheDocument();
        expect(screen.getByTestId('optimization-suggestions')).toBeInTheDocument();
      });
    });

    it('should show recommended order', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const suggestButton = screen.getByText('Suggest Order');
      fireEvent.click(suggestButton);
      
      await waitFor(() => {
        expect(screen.getByText('Recommended Order')).toBeInTheDocument();
        expect(screen.getByText('1. Definitions')).toBeInTheDocument();
        expect(screen.getByText('2. Scope')).toBeInTheDocument();
      });
    });

    it('should apply recommended order', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const suggestButton = screen.getByText('Suggest Order');
      fireEvent.click(suggestButton);
      
      await waitFor(() => {
        const applyButton = screen.getByText('Apply Recommended Order');
        fireEvent.click(applyButton);
        expect(screen.getByText('Order applied')).toBeInTheDocument();
      });
    });

    it('should allow manual section ordering', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const moveUpButton = screen.getByTestId('move-up-clause-2');
      fireEvent.click(moveUpButton);
      
      await waitFor(() => {
        expect(screen.getByText('Clause moved up')).toBeInTheDocument();
      });
    });
  });

  describe('Legal Review Triggers', () => {
    it('should trigger legal review for high-risk clauses', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const highRiskClause = screen.getByTestId('clause-limitation-liability');
      const dropZone = screen.getByTestId('assembly-drop-zone');
      
      fireEvent.dragStart(highRiskClause);
      fireEvent.drop(dropZone);
      
      await waitFor(() => {
        expect(screen.getByText('Legal review required')).toBeInTheDocument();
        expect(screen.getByTestId('legal-review-badge')).toBeInTheDocument();
      });
    });

    it('should show review requirements', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const reviewBadge = screen.getByTestId('legal-review-badge');
      fireEvent.click(reviewBadge);
      
      await waitFor(() => {
        expect(screen.getByText('Review Requirements')).toBeInTheDocument();
        expect(screen.getByText('High-risk clause modification')).toBeInTheDocument();
        expect(screen.getByText('Jurisdiction: CA')).toBeInTheDocument();
      });
    });

    it('should request legal review', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const requestButton = screen.getByText('Request Legal Review');
      fireEvent.click(requestButton);
      
      await waitFor(() => {
        expect(screen.getByText('Review requested')).toBeInTheDocument();
        expect(screen.getByText('Status: Pending Review')).toBeInTheDocument();
      });
    });

    it('should track review status', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      await waitFor(() => {
        expect(screen.getByTestId('review-status-pending')).toBeInTheDocument();
        expect(screen.getByText('2 clauses pending review')).toBeInTheDocument();
      });
    });
  });

  describe('Approval Workflows', () => {
    it('should show approval workflow', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const workflowButton = screen.getByText('View Workflow');
      fireEvent.click(workflowButton);
      
      await waitFor(() => {
        expect(screen.getByText('Approval Workflow')).toBeInTheDocument();
        expect(screen.getByText('Step 1: Legal Review')).toBeInTheDocument();
        expect(screen.getByText('Step 2: Manager Approval')).toBeInTheDocument();
      });
    });

    it('should submit for approval', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const submitButton = screen.getByText('Submit for Approval');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Submitted for approval')).toBeInTheDocument();
        expect(screen.getByText('Status: In Review')).toBeInTheDocument();
      });
    });

    it('should show approval progress', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      await waitFor(() => {
        expect(screen.getByTestId('approval-progress')).toBeInTheDocument();
        expect(screen.getByText('1 of 3 approvals')).toBeInTheDocument();
      });
    });

    it('should handle approval actions', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const approveButton = screen.getByText('Approve');
      fireEvent.click(approveButton);
      
      await waitFor(() => {
        expect(screen.getByText('Assembly approved')).toBeInTheDocument();
      });
    });
  });

  describe('Version Tracking', () => {
    it('should show assembly versions', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const versionsTab = screen.getByText('Versions');
      fireEvent.click(versionsTab);
      
      await waitFor(() => {
        expect(screen.getByText('Version History')).toBeInTheDocument();
        expect(screen.getByText('v1.0')).toBeInTheDocument();
        expect(screen.getByText('v1.1')).toBeInTheDocument();
      });
    });

    it('should compare versions', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const compareButton = screen.getByText('Compare Versions');
      fireEvent.click(compareButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('version-comparison')).toBeInTheDocument();
        expect(screen.getByText('Added: Arbitration Clause')).toBeInTheDocument();
        expect(screen.getByText('Removed: Jurisdiction Clause')).toBeInTheDocument();
      });
    });

    it('should restore previous version', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const restoreButton = screen.getByTestId('restore-version-1');
      fireEvent.click(restoreButton);
      
      await waitFor(() => {
        expect(screen.getByText('Version restored')).toBeInTheDocument();
      });
    });

    it('should save new version', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const saveButton = screen.getByText('Save Version');
      fireEvent.click(saveButton);
      
      const versionInput = screen.getByLabelText('Version Notes');
      await userEvent.type(versionInput, 'Added payment terms');
      
      const confirmButton = screen.getByText('Save');
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByText('Version saved')).toBeInTheDocument();
      });
    });
  });

  describe('Usage Analytics', () => {
    it('should show clause usage statistics', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const analyticsTab = screen.getByText('Analytics');
      fireEvent.click(analyticsTab);
      
      await waitFor(() => {
        expect(screen.getByText('Usage Analytics')).toBeInTheDocument();
        expect(screen.getByText('Most Used Clauses')).toBeInTheDocument();
        expect(screen.getByText('Payment Terms: 145 uses')).toBeInTheDocument();
      });
    });

    it('should show clause combinations', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const analyticsTab = screen.getByText('Analytics');
      fireEvent.click(analyticsTab);
      
      await waitFor(() => {
        expect(screen.getByText('Common Combinations')).toBeInTheDocument();
        expect(screen.getByText('Payment + Delivery: 89%')).toBeInTheDocument();
      });
    });

    it('should show success rates', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const analyticsTab = screen.getByText('Analytics');
      fireEvent.click(analyticsTab);
      
      await waitFor(() => {
        expect(screen.getByText('Approval Success Rate')).toBeInTheDocument();
        expect(screen.getByText('87% approved without changes')).toBeInTheDocument();
      });
    });

    it('should export analytics data', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const analyticsTab = screen.getByText('Analytics');
      fireEvent.click(analyticsTab);
      
      const exportButton = screen.getByText('Export Analytics');
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(screen.getByText('Analytics exported')).toBeInTheDocument();
      });
    });
  });

  describe('Playbook Compliance', () => {
    it('should check playbook compliance', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const checkButton = screen.getByText('Check Compliance');
      fireEvent.click(checkButton);
      
      await waitFor(() => {
        expect(screen.getByText('Compliance Score: 92%')).toBeInTheDocument();
      });
    });

    it('should show non-compliant items', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const checkButton = screen.getByText('Check Compliance');
      fireEvent.click(checkButton);
      
      await waitFor(() => {
        expect(screen.getByText('Non-Compliant Items')).toBeInTheDocument();
        expect(screen.getByText('Missing: Governing Law')).toBeInTheDocument();
      });
    });

    it('should suggest compliant alternatives', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const suggestButton = screen.getByText('Suggest Compliant Clauses');
      fireEvent.click(suggestButton);
      
      await waitFor(() => {
        expect(screen.getByText('Recommended for Compliance')).toBeInTheDocument();
        expect(screen.getByTestId('compliant-clause-suggestion')).toBeInTheDocument();
      });
    });

    it('should apply playbook template', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const templateButton = screen.getByText('Apply Playbook Template');
      fireEvent.click(templateButton);
      
      await waitFor(() => {
        expect(screen.getByText('Playbook template applied')).toBeInTheDocument();
        expect(screen.getByText('Compliance Score: 100%')).toBeInTheDocument();
      });
    });
  });

  describe('Export and Save', () => {
    it('should save assembly as template', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const saveButton = screen.getByText('Save as Template');
      fireEvent.click(saveButton);
      
      const nameInput = screen.getByLabelText('Template Name');
      await userEvent.type(nameInput, 'Standard Service Agreement');
      
      const confirmButton = screen.getByText('Save Template');
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByText('Template saved')).toBeInTheDocument();
      });
    });

    it('should export assembly to document', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const exportButton = screen.getByText('Export Document');
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(screen.getByText('Select Format')).toBeInTheDocument();
        expect(screen.getByText('Word')).toBeInTheDocument();
        expect(screen.getByText('PDF')).toBeInTheDocument();
      });
    });

    it('should preview before export', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const previewButton = screen.getByText('Preview Document');
      fireEvent.click(previewButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('document-preview')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ClauseAssemblySystem />, { wrapper });
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Clause Assembly System');
      expect(screen.getByTestId('clause-library')).toHaveAttribute('aria-label', 'Available Clauses');
      expect(screen.getByTestId('assembly-area')).toHaveAttribute('aria-label', 'Document Assembly Area');
    });

    it('should support keyboard navigation', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const firstClause = screen.getByTestId('clause-payment-terms');
      firstClause.focus();
      
      fireEvent.keyDown(firstClause, { key: 'Enter' });
      
      await waitFor(() => {
        expect(screen.getByText('Payment Terms added')).toBeInTheDocument();
      });
    });

    it('should announce status changes', async () => {
      render(<ClauseAssemblySystem />, { wrapper });
      const clause = screen.getByTestId('clause-payment-terms');
      const dropZone = screen.getByTestId('assembly-drop-zone');
      
      fireEvent.dragStart(clause);
      fireEvent.drop(dropZone);
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent('Payment Terms added to assembly');
      });
    });
  });

  describe('Permissions', () => {
    it('should hide features for viewers', () => {
      (useAuthStore as any).mockReturnValue({
        user: { id: '1', name: 'Test User', role: 'viewer' },
        hasPermission: (perm: string) => perm === 'contracts:view'
      });
      
      render(<ClauseAssemblySystem />, { wrapper });
      expect(screen.queryByText('Save as Template')).not.toBeInTheDocument();
      expect(screen.queryByText('Submit for Approval')).not.toBeInTheDocument();
    });

    it('should show read-only mode', () => {
      (useAuthStore as any).mockReturnValue({
        user: { id: '1', name: 'Test User', role: 'viewer' },
        hasPermission: (perm: string) => perm === 'contracts:view'
      });
      
      render(<ClauseAssemblySystem />, { wrapper });
      expect(screen.getByText('Read-only mode')).toBeInTheDocument();
    });
  });
});