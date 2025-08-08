import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ClauseRepository } from '../ClauseRepository';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface Clause {
  id: string;
  title: string;
  content: string;
  category: string;
  subcategory?: string;
  tags: string[];
  version: string;
  status: 'draft' | 'review' | 'approved' | 'deprecated';
  approvalStatus: {
    approvedBy?: string;
    approvedAt?: string;
    reviewNotes?: string;
  };
  riskLevel: 'low' | 'medium' | 'high';
  jurisdiction?: string;
  language: string;
  usageCount: number;
  lastUsed?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  parentClauseId?: string;
  metadata?: {
    industry?: string[];
    contractTypes?: string[];
    effectiveDate?: string;
    expirationDate?: string;
    customFields?: Record<string, any>;
  };
}

interface ClauseRepositoryProps {
  clauses?: Clause[];
  isLoading?: boolean;
  currentUser: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
  };
  onCreateClause?: (clause: Omit<Clause, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateClause?: (clauseId: string, updates: Partial<Clause>) => Promise<void>;
  onDeleteClause?: (clauseId: string) => Promise<void>;
  onApproveClause?: (clauseId: string, notes?: string) => Promise<void>;
  onDeprecateClause?: (clauseId: string, reason: string) => Promise<void>;
  onCloneClause?: (clauseId: string) => Promise<void>;
  onExportClauses?: (clauseIds: string[], format: 'json' | 'csv' | 'docx') => Promise<void>;
  onImportClauses?: (file: File) => Promise<void>;
  onTagClause?: (clauseId: string, tags: string[]) => Promise<void>;
  onViewHistory?: (clauseId: string) => void;
  onCompareVersions?: (clauseId1: string, clauseId2: string) => void;
}

// Mock API
vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('ClauseRepository', () => {
  let queryClient: QueryClient;
  const mockOnCreateClause = vi.fn();
  const mockOnUpdateClause = vi.fn();
  const mockOnDeleteClause = vi.fn();
  const mockOnApproveClause = vi.fn();
  const mockOnDeprecateClause = vi.fn();
  const mockOnCloneClause = vi.fn();
  const mockOnExportClauses = vi.fn();
  const mockOnImportClauses = vi.fn();
  const mockOnTagClause = vi.fn();
  const mockOnViewHistory = vi.fn();
  const mockOnCompareVersions = vi.fn();

  const sampleClauses: Clause[] = [
    {
      id: 'clause1',
      title: 'Limitation of Liability',
      content: 'Neither party shall be liable for any indirect, incidental, special, consequential or punitive damages.',
      category: 'Liability',
      subcategory: 'Limitations',
      tags: ['standard', 'limitation', 'damages'],
      version: '2.0',
      status: 'approved',
      approvalStatus: {
        approvedBy: 'John Doe',
        approvedAt: '2024-01-10T10:00:00Z',
      },
      riskLevel: 'low',
      jurisdiction: 'US',
      language: 'en',
      usageCount: 45,
      lastUsed: '2024-01-15T14:00:00Z',
      createdBy: 'Jane Smith',
      createdAt: '2023-06-01T09:00:00Z',
      updatedAt: '2024-01-10T10:00:00Z',
      metadata: {
        industry: ['Technology', 'Healthcare'],
        contractTypes: ['Service Agreement', 'License Agreement'],
      },
    },
    {
      id: 'clause2',
      title: 'Confidentiality',
      content: 'Each party agrees to maintain the confidentiality of the other party\'s proprietary information.',
      category: 'Confidentiality',
      tags: ['nda', 'confidential', 'proprietary'],
      version: '1.5',
      status: 'approved',
      approvalStatus: {
        approvedBy: 'Bob Johnson',
        approvedAt: '2024-01-08T11:00:00Z',
      },
      riskLevel: 'medium',
      jurisdiction: 'US',
      language: 'en',
      usageCount: 78,
      lastUsed: '2024-01-16T09:00:00Z',
      createdBy: 'Jane Smith',
      createdAt: '2023-05-15T10:00:00Z',
      updatedAt: '2024-01-08T11:00:00Z',
      metadata: {
        contractTypes: ['NDA', 'Service Agreement'],
      },
    },
    {
      id: 'clause3',
      title: 'Termination for Convenience',
      content: 'Either party may terminate this agreement with 30 days written notice.',
      category: 'Termination',
      tags: ['termination', 'convenience', 'notice'],
      version: '1.0',
      status: 'draft',
      riskLevel: 'high',
      language: 'en',
      usageCount: 12,
      createdBy: 'Alice Brown',
      createdAt: '2024-01-12T13:00:00Z',
      updatedAt: '2024-01-12T13:00:00Z',
    },
    {
      id: 'clause4',
      title: 'Force Majeure',
      content: 'Neither party shall be liable for delays caused by events beyond their reasonable control.',
      category: 'General',
      tags: ['force majeure', 'excuse', 'delay'],
      version: '1.2',
      status: 'deprecated',
      approvalStatus: {
        reviewNotes: 'Deprecated in favor of updated language',
      },
      riskLevel: 'low',
      jurisdiction: 'Global',
      language: 'en',
      usageCount: 5,
      createdBy: 'Jane Smith',
      createdAt: '2023-01-01T08:00:00Z',
      updatedAt: '2023-12-01T10:00:00Z',
    },
  ];

  const currentUser = {
    id: 'user1',
    name: 'John Doe',
    role: 'legal_admin',
    permissions: ['view_clauses', 'create_clauses', 'edit_clauses', 'approve_clauses', 'delete_clauses'],
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      clauses: sampleClauses,
      currentUser,
      onCreateClause: mockOnCreateClause,
      onUpdateClause: mockOnUpdateClause,
      onDeleteClause: mockOnDeleteClause,
      onApproveClause: mockOnApproveClause,
      onDeprecateClause: mockOnDeprecateClause,
      onCloneClause: mockOnCloneClause,
      onExportClauses: mockOnExportClauses,
      onImportClauses: mockOnImportClauses,
      onTagClause: mockOnTagClause,
      onViewHistory: mockOnViewHistory,
      onCompareVersions: mockOnCompareVersions,
      ...props,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <ClauseRepository {...defaultProps} />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render clause repository interface', () => {
      renderComponent();
      
      expect(screen.getByText('Clause Repository')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add clause/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/search clauses/i)).toBeInTheDocument();
    });

    it('should display clause statistics', () => {
      renderComponent();
      
      expect(screen.getByText('Total Clauses')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Draft')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should show usage analytics', () => {
      renderComponent();
      
      expect(screen.getByText('Most Used')).toBeInTheDocument();
      expect(screen.getByText('Confidentiality')).toBeInTheDocument();
      expect(screen.getByText('78 uses')).toBeInTheDocument();
    });
  });

  describe('Clause List', () => {
    it('should display all clauses', () => {
      renderComponent();
      
      expect(screen.getByText('Limitation of Liability')).toBeInTheDocument();
      expect(screen.getByText('Confidentiality')).toBeInTheDocument();
      expect(screen.getByText('Termination for Convenience')).toBeInTheDocument();
      expect(screen.getByText('Force Majeure')).toBeInTheDocument();
    });

    it('should show clause categories', () => {
      renderComponent();
      
      expect(screen.getByText('Liability')).toBeInTheDocument();
      expect(screen.getByText('Termination')).toBeInTheDocument();
      expect(screen.getByText('General')).toBeInTheDocument();
    });

    it('should display status badges', () => {
      renderComponent();
      
      const approvedBadges = screen.getAllByText('approved');
      expect(approvedBadges).toHaveLength(2);
      expect(screen.getByText('draft')).toBeInTheDocument();
      expect(screen.getByText('deprecated')).toBeInTheDocument();
    });

    it('should show risk levels', () => {
      renderComponent();
      
      expect(screen.getByText('Low Risk')).toBeInTheDocument();
      expect(screen.getByText('Medium Risk')).toBeInTheDocument();
      expect(screen.getByText('High Risk')).toBeInTheDocument();
    });

    it('should display version information', () => {
      renderComponent();
      
      expect(screen.getByText('v2.0')).toBeInTheDocument();
      expect(screen.getByText('v1.5')).toBeInTheDocument();
      expect(screen.getByText('v1.0')).toBeInTheDocument();
    });

    it('should show usage count', () => {
      renderComponent();
      
      expect(screen.getByText('45 uses')).toBeInTheDocument();
      expect(screen.getByText('78 uses')).toBeInTheDocument();
      expect(screen.getByText('12 uses')).toBeInTheDocument();
    });

    it('should display tags', () => {
      renderComponent();
      
      expect(screen.getByText('standard')).toBeInTheDocument();
      expect(screen.getByText('limitation')).toBeInTheDocument();
      expect(screen.getByText('nda')).toBeInTheDocument();
      expect(screen.getByText('termination')).toBeInTheDocument();
    });

    it('should show last used date', () => {
      renderComponent();
      
      expect(screen.getByText(/Last used:/)).toBeInTheDocument();
    });
  });

  describe('Search and Filter', () => {
    it('should search clauses by title', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/search clauses/i);
      await userEvent.type(searchInput, 'liability');
      
      expect(screen.getByText('Limitation of Liability')).toBeInTheDocument();
      expect(screen.queryByText('Confidentiality')).not.toBeInTheDocument();
    });

    it('should filter by category', async () => {
      renderComponent();
      
      const categoryFilter = screen.getByLabelText('Filter by category');
      await userEvent.selectOptions(categoryFilter, 'Liability');
      
      expect(screen.getByText('Limitation of Liability')).toBeInTheDocument();
      expect(screen.queryByText('Confidentiality')).not.toBeInTheDocument();
    });

    it('should filter by status', async () => {
      renderComponent();
      
      const statusFilter = screen.getByLabelText('Filter by status');
      await userEvent.selectOptions(statusFilter, 'approved');
      
      expect(screen.getByText('Limitation of Liability')).toBeInTheDocument();
      expect(screen.getByText('Confidentiality')).toBeInTheDocument();
      expect(screen.queryByText('Termination for Convenience')).not.toBeInTheDocument();
    });

    it('should filter by risk level', async () => {
      renderComponent();
      
      const riskFilter = screen.getByLabelText('Filter by risk level');
      await userEvent.selectOptions(riskFilter, 'high');
      
      expect(screen.getByText('Termination for Convenience')).toBeInTheDocument();
      expect(screen.queryByText('Limitation of Liability')).not.toBeInTheDocument();
    });

    it('should filter by tags', async () => {
      renderComponent();
      
      const tagButton = screen.getByRole('button', { name: /nda/i });
      fireEvent.click(tagButton);
      
      expect(screen.getByText('Confidentiality')).toBeInTheDocument();
      expect(screen.queryByText('Limitation of Liability')).not.toBeInTheDocument();
    });

    it('should sort clauses', async () => {
      renderComponent();
      
      const sortSelect = screen.getByLabelText('Sort by');
      await userEvent.selectOptions(sortSelect, 'usage');
      
      const clauseTitles = screen.getAllByTestId(/clause-title/i);
      expect(clauseTitles[0]).toHaveTextContent('Confidentiality');
    });

    it('should clear filters', async () => {
      renderComponent();
      
      const categoryFilter = screen.getByLabelText('Filter by category');
      await userEvent.selectOptions(categoryFilter, 'Liability');
      
      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      fireEvent.click(clearButton);
      
      expect(screen.getByText('Limitation of Liability')).toBeInTheDocument();
      expect(screen.getByText('Confidentiality')).toBeInTheDocument();
    });
  });

  describe('Clause Actions', () => {
    it('should create new clause', async () => {
      renderComponent();
      
      const addButton = screen.getByRole('button', { name: /add clause/i });
      fireEvent.click(addButton);
      
      const titleInput = screen.getByLabelText('Clause title');
      await userEvent.type(titleInput, 'New Test Clause');
      
      const contentInput = screen.getByLabelText('Clause content');
      await userEvent.type(contentInput, 'This is a test clause content.');
      
      const saveButton = screen.getByRole('button', { name: /save clause/i });
      await userEvent.click(saveButton);
      
      expect(mockOnCreateClause).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Test Clause',
          content: 'This is a test clause content.',
        })
      );
    });

    it('should edit existing clause', async () => {
      renderComponent();
      
      const editButton = screen.getAllByRole('button', { name: /edit/i })[0];
      fireEvent.click(editButton);
      
      const contentInput = screen.getByLabelText('Clause content');
      await userEvent.clear(contentInput);
      await userEvent.type(contentInput, 'Updated clause content');
      
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await userEvent.click(saveButton);
      
      expect(mockOnUpdateClause).toHaveBeenCalledWith(
        'clause1',
        expect.objectContaining({
          content: 'Updated clause content',
        })
      );
    });

    it('should delete clause', async () => {
      renderComponent();
      
      const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
      fireEvent.click(deleteButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      await userEvent.click(confirmButton);
      
      expect(mockOnDeleteClause).toHaveBeenCalledWith('clause1');
    });

    it('should approve clause', async () => {
      renderComponent();
      
      const approveButton = screen.getAllByRole('button', { name: /approve/i })[0];
      fireEvent.click(approveButton);
      
      const notesInput = screen.getByLabelText('Approval notes');
      await userEvent.type(notesInput, 'Approved for use');
      
      const confirmButton = screen.getByRole('button', { name: /confirm approval/i });
      await userEvent.click(confirmButton);
      
      expect(mockOnApproveClause).toHaveBeenCalledWith('clause3', 'Approved for use');
    });

    it('should deprecate clause', async () => {
      renderComponent();
      
      const deprecateButton = screen.getAllByRole('button', { name: /deprecate/i })[0];
      fireEvent.click(deprecateButton);
      
      const reasonInput = screen.getByLabelText('Deprecation reason');
      await userEvent.type(reasonInput, 'Outdated language');
      
      const confirmButton = screen.getByRole('button', { name: /confirm deprecation/i });
      await userEvent.click(confirmButton);
      
      expect(mockOnDeprecateClause).toHaveBeenCalledWith('clause1', 'Outdated language');
    });

    it('should clone clause', async () => {
      renderComponent();
      
      const cloneButton = screen.getAllByRole('button', { name: /clone/i })[0];
      await userEvent.click(cloneButton);
      
      expect(mockOnCloneClause).toHaveBeenCalledWith('clause1');
    });

    it('should view clause history', async () => {
      renderComponent();
      
      const historyButton = screen.getAllByRole('button', { name: /view history/i })[0];
      await userEvent.click(historyButton);
      
      expect(mockOnViewHistory).toHaveBeenCalledWith('clause1');
    });

    it('should compare versions', async () => {
      renderComponent();
      
      const compareCheckbox1 = screen.getAllByRole('checkbox', { name: /select for comparison/i })[0];
      const compareCheckbox2 = screen.getAllByRole('checkbox', { name: /select for comparison/i })[1];
      
      await userEvent.click(compareCheckbox1);
      await userEvent.click(compareCheckbox2);
      
      const compareButton = screen.getByRole('button', { name: /compare selected/i });
      await userEvent.click(compareButton);
      
      expect(mockOnCompareVersions).toHaveBeenCalledWith('clause1', 'clause2');
    });
  });

  describe('Bulk Operations', () => {
    it('should select multiple clauses', async () => {
      renderComponent();
      
      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });
      await userEvent.click(selectAllCheckbox);
      
      expect(screen.getByText('4 clauses selected')).toBeInTheDocument();
    });

    it('should export selected clauses', async () => {
      renderComponent();
      
      const selectCheckbox1 = screen.getAllByRole('checkbox', { name: /select clause/i })[0];
      const selectCheckbox2 = screen.getAllByRole('checkbox', { name: /select clause/i })[1];
      
      await userEvent.click(selectCheckbox1);
      await userEvent.click(selectCheckbox2);
      
      const exportButton = screen.getByRole('button', { name: /export selected/i });
      fireEvent.click(exportButton);
      
      const jsonOption = screen.getByRole('menuitem', { name: /export as json/i });
      await userEvent.click(jsonOption);
      
      expect(mockOnExportClauses).toHaveBeenCalledWith(['clause1', 'clause2'], 'json');
    });

    it('should bulk tag clauses', async () => {
      renderComponent();
      
      const selectCheckbox = screen.getAllByRole('checkbox', { name: /select clause/i })[0];
      await userEvent.click(selectCheckbox);
      
      const bulkTagButton = screen.getByRole('button', { name: /add tags/i });
      fireEvent.click(bulkTagButton);
      
      const tagInput = screen.getByLabelText('Tags');
      await userEvent.type(tagInput, 'important, reviewed');
      
      const applyButton = screen.getByRole('button', { name: /apply tags/i });
      await userEvent.click(applyButton);
      
      expect(mockOnTagClause).toHaveBeenCalledWith('clause1', ['important', 'reviewed']);
    });

    it('should bulk delete clauses', async () => {
      renderComponent();
      
      const selectCheckbox1 = screen.getAllByRole('checkbox', { name: /select clause/i })[0];
      const selectCheckbox2 = screen.getAllByRole('checkbox', { name: /select clause/i })[1];
      
      await userEvent.click(selectCheckbox1);
      await userEvent.click(selectCheckbox2);
      
      const bulkDeleteButton = screen.getByRole('button', { name: /delete selected/i });
      fireEvent.click(bulkDeleteButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm bulk delete/i });
      await userEvent.click(confirmButton);
      
      expect(mockOnDeleteClause).toHaveBeenCalledWith('clause1');
      expect(mockOnDeleteClause).toHaveBeenCalledWith('clause2');
    });
  });

  describe('Import/Export', () => {
    it('should import clauses from file', async () => {
      renderComponent();
      
      const importButton = screen.getByRole('button', { name: /import clauses/i });
      fireEvent.click(importButton);
      
      const file = new File(['clause data'], 'clauses.json', { type: 'application/json' });
      const fileInput = screen.getByLabelText('Select file');
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(fileInput);
      
      await waitFor(() => {
        expect(mockOnImportClauses).toHaveBeenCalledWith(file);
      });
    });

    it('should export all clauses', async () => {
      renderComponent();
      
      const exportAllButton = screen.getByRole('button', { name: /export all/i });
      fireEvent.click(exportAllButton);
      
      const csvOption = screen.getByRole('menuitem', { name: /export as csv/i });
      await userEvent.click(csvOption);
      
      expect(mockOnExportClauses).toHaveBeenCalledWith(
        ['clause1', 'clause2', 'clause3', 'clause4'],
        'csv'
      );
    });
  });

  describe('View Modes', () => {
    it('should switch between grid and list view', async () => {
      renderComponent();
      
      const gridButton = screen.getByRole('button', { name: /grid view/i });
      const listButton = screen.getByRole('button', { name: /list view/i });
      
      await userEvent.click(listButton);
      expect(screen.getByTestId('list-view')).toBeInTheDocument();
      
      await userEvent.click(gridButton);
      expect(screen.getByTestId('grid-view')).toBeInTheDocument();
    });

    it('should show clause preview', async () => {
      renderComponent();
      
      const previewButton = screen.getAllByRole('button', { name: /preview/i })[0];
      fireEvent.click(previewButton);
      
      expect(screen.getByTestId('clause-preview')).toBeInTheDocument();
      expect(screen.getByText(/Neither party shall be liable/)).toBeInTheDocument();
    });

    it('should expand clause details', async () => {
      renderComponent();
      
      const expandButton = screen.getAllByRole('button', { name: /expand details/i })[0];
      fireEvent.click(expandButton);
      
      expect(screen.getByText('Industry:')).toBeInTheDocument();
      expect(screen.getByText('Technology')).toBeInTheDocument();
      expect(screen.getByText('Healthcare')).toBeInTheDocument();
    });
  });

  describe('Analytics', () => {
    it('should display usage trends', () => {
      renderComponent();
      
      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      fireEvent.click(analyticsTab);
      
      expect(screen.getByTestId('usage-chart')).toBeInTheDocument();
      expect(screen.getByText('Usage Trend')).toBeInTheDocument();
    });

    it('should show category distribution', () => {
      renderComponent();
      
      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      fireEvent.click(analyticsTab);
      
      expect(screen.getByTestId('category-chart')).toBeInTheDocument();
      expect(screen.getByText('Category Distribution')).toBeInTheDocument();
    });

    it('should display deprecation timeline', () => {
      renderComponent();
      
      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      fireEvent.click(analyticsTab);
      
      expect(screen.getByTestId('deprecation-timeline')).toBeInTheDocument();
    });
  });

  describe('Permissions', () => {
    it('should hide create button without permission', () => {
      const limitedUser = {
        ...currentUser,
        permissions: ['view_clauses'],
      };
      
      renderComponent({ currentUser: limitedUser });
      
      expect(screen.queryByRole('button', { name: /add clause/i })).not.toBeInTheDocument();
    });

    it('should disable edit without permission', () => {
      const limitedUser = {
        ...currentUser,
        permissions: ['view_clauses'],
      };
      
      renderComponent({ currentUser: limitedUser });
      
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });

    it('should hide approve button without permission', () => {
      const limitedUser = {
        ...currentUser,
        permissions: ['view_clauses', 'edit_clauses'],
      };
      
      renderComponent({ currentUser: limitedUser });
      
      expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('region', { name: /clause repository/i })).toBeInTheDocument();
      expect(screen.getByRole('search')).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: /clause filters/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      const firstClause = screen.getAllByRole('article')[0];
      firstClause.focus();
      
      fireEvent.keyDown(firstClause, { key: 'Enter' });
      
      expect(screen.getByTestId('clause-preview')).toBeInTheDocument();
    });

    it('should announce clause updates', async () => {
      renderComponent();
      
      const approveButton = screen.getAllByRole('button', { name: /approve/i })[0];
      fireEvent.click(approveButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm approval/i });
      await userEvent.click(confirmButton);
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/clause approved/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle create failure', async () => {
      mockOnCreateClause.mockRejectedValue(new Error('Failed to create'));
      renderComponent();
      
      const addButton = screen.getByRole('button', { name: /add clause/i });
      fireEvent.click(addButton);
      
      const saveButton = screen.getByRole('button', { name: /save clause/i });
      await userEvent.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to create clause/i)).toBeInTheDocument();
      });
    });

    it('should show loading state', () => {
      renderComponent({ isLoading: true });
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Loading clauses...')).toBeInTheDocument();
    });

    it('should handle empty state', () => {
      renderComponent({ clauses: [] });
      
      expect(screen.getByText('No clauses found')).toBeInTheDocument();
      expect(screen.getByText(/create your first clause/i)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should handle large number of clauses', () => {
      const manyClauses = Array.from({ length: 100 }, (_, i) => ({
        ...sampleClauses[0],
        id: `clause${i}`,
        title: `Clause ${i}`,
      }));
      
      renderComponent({ clauses: manyClauses });
      
      expect(screen.getByText('Total Clauses')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('should paginate clause list', () => {
      const manyClauses = Array.from({ length: 50 }, (_, i) => ({
        ...sampleClauses[0],
        id: `clause${i}`,
        title: `Clause ${i}`,
      }));
      
      renderComponent({ clauses: manyClauses });
      
      expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });
  });
});