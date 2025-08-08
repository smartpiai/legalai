import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ContractsListPage from '../ContractsListPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';

interface Contract {
  id: string;
  title: string;
  contract_number: string;
  contract_type: string;
  status: 'draft' | 'review' | 'approved' | 'active' | 'expired' | 'terminated';
  start_date: string;
  end_date: string;
  value: number;
  currency: string;
  parties: string[];
  owner: string;
  department: string;
  tags: string[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  renewal_date?: string;
  created_at: string;
  updated_at: string;
  version: number;
  parent_id?: string;
}

interface ContractStats {
  total: number;
  active: number;
  pending_renewal: number;
  expired: number;
  total_value: number;
  avg_value: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  by_risk: Record<string, number>;
}

// Mock modules
vi.mock('../../../stores/authStore');
vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../components/contracts/ContractOverviewWidget', () => ({
  ContractOverviewWidget: ({ stats }: { stats: ContractStats }) => (
    <div data-testid="contract-overview-widget">
      <div>Total: {stats.total}</div>
      <div>Active: {stats.active}</div>
      <div>Value: ${stats.total_value}</div>
    </div>
  ),
}));

vi.mock('../../../components/contracts/RecentActivityFeed', () => ({
  RecentActivityFeed: () => <div data-testid="recent-activity-feed">Recent Activity</div>,
}));

vi.mock('../../../components/contracts/QuickActionButtons', () => ({
  QuickActionButtons: () => <div data-testid="quick-action-buttons">Quick Actions</div>,
}));

vi.mock('../../../components/contracts/FilterSortControls', () => ({
  FilterSortControls: ({ onFilterChange }: any) => (
    <div data-testid="filter-sort-controls">
      <button onClick={() => onFilterChange({ status: 'active' })}>Filter Active</button>
    </div>
  ),
}));

vi.mock('../../../components/contracts/BulkOperationsBar', () => ({
  BulkOperationsBar: ({ selectedItems }: any) => (
    <div data-testid="bulk-operations-bar">
      Selected: {selectedItems.length}
    </div>
  ),
}));

describe('ContractsListPage', () => {
  let queryClient: QueryClient;
  const mockUser = {
    id: 'user1',
    email: 'user@example.com',
    name: 'Test User',
    role: 'contract_manager',
    permissions: ['view_contracts', 'create_contracts', 'edit_contracts', 'delete_contracts'],
    tenant_id: 'tenant1',
  };

  const sampleContracts: Contract[] = [
    {
      id: 'contract1',
      title: 'Service Agreement ABC',
      contract_number: 'CON-2024-001',
      contract_type: 'Service Agreement',
      status: 'active',
      start_date: '2024-01-01',
      end_date: '2024-12-31',
      value: 150000,
      currency: 'USD',
      parties: ['Company A', 'Company B'],
      owner: 'John Doe',
      department: 'Legal',
      tags: ['priority', 'renewal'],
      risk_level: 'low',
      renewal_date: '2024-11-01',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-06-15T14:30:00Z',
      version: 2,
    },
    {
      id: 'contract2',
      title: 'Purchase Order XYZ',
      contract_number: 'CON-2024-002',
      contract_type: 'Purchase Order',
      status: 'review',
      start_date: '2024-02-01',
      end_date: '2025-01-31',
      value: 75000,
      currency: 'USD',
      parties: ['Company A', 'Vendor X'],
      owner: 'Jane Smith',
      department: 'Procurement',
      tags: ['urgent'],
      risk_level: 'medium',
      created_at: '2024-02-01T09:00:00Z',
      updated_at: '2024-06-14T11:00:00Z',
      version: 1,
    },
    {
      id: 'contract3',
      title: 'NDA with Partner',
      contract_number: 'CON-2024-003',
      contract_type: 'NDA',
      status: 'expired',
      start_date: '2023-06-01',
      end_date: '2024-05-31',
      value: 0,
      currency: 'USD',
      parties: ['Company A', 'Partner Corp'],
      owner: 'Mike Johnson',
      department: 'Legal',
      tags: ['confidential'],
      risk_level: 'low',
      created_at: '2023-06-01T08:00:00Z',
      updated_at: '2024-05-31T17:00:00Z',
      version: 1,
    },
  ];

  const sampleStats: ContractStats = {
    total: 156,
    active: 89,
    pending_renewal: 12,
    expired: 23,
    total_value: 15750000,
    avg_value: 100961,
    by_status: {
      draft: 15,
      review: 17,
      approved: 10,
      active: 89,
      expired: 23,
      terminated: 2,
    },
    by_type: {
      'Service Agreement': 45,
      'Purchase Order': 38,
      'NDA': 28,
      'License Agreement': 20,
      'Employment Contract': 25,
    },
    by_risk: {
      low: 78,
      medium: 56,
      high: 18,
      critical: 4,
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
    (useAuthStore as any).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ContractsListPage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  describe('Page Layout', () => {
    it('should render the contracts list page', () => {
      renderComponent();
      
      expect(screen.getByTestId('contracts-list-page')).toBeInTheDocument();
      expect(screen.getByText('Contracts')).toBeInTheDocument();
    });

    it('should display page header with title and actions', () => {
      renderComponent();
      
      expect(screen.getByRole('heading', { name: /contracts/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /new contract/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument();
    });

    it('should show breadcrumbs navigation', () => {
      renderComponent();
      
      const breadcrumbs = screen.getByRole('navigation', { name: /breadcrumb/i });
      expect(breadcrumbs).toBeInTheDocument();
      expect(within(breadcrumbs).getByText('Home')).toBeInTheDocument();
      expect(within(breadcrumbs).getByText('Contracts')).toBeInTheDocument();
    });

    it('should display overview statistics widget', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('contract-overview-widget')).toBeInTheDocument();
      });
    });

    it('should show recent activity feed', () => {
      renderComponent();
      
      expect(screen.getByTestId('recent-activity-feed')).toBeInTheDocument();
    });

    it('should display quick action buttons', () => {
      renderComponent();
      
      expect(screen.getByTestId('quick-action-buttons')).toBeInTheDocument();
    });
  });

  describe('Contract List Display', () => {
    it('should render contracts in a table format', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.getByText('Contract Number')).toBeInTheDocument();
        expect(screen.getByText('Title')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Value')).toBeInTheDocument();
      });
    });

    it('should display contract data correctly', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('CON-2024-001')).toBeInTheDocument();
        expect(screen.getByText('Service Agreement ABC')).toBeInTheDocument();
        expect(screen.getByText('$150,000')).toBeInTheDocument();
      });
    });

    it('should show status badges with colors', async () => {
      renderComponent();
      
      await waitFor(() => {
        const activeBadge = screen.getByTestId('status-badge-active');
        expect(activeBadge).toHaveClass('bg-green-100');
        
        const reviewBadge = screen.getByTestId('status-badge-review');
        expect(reviewBadge).toHaveClass('bg-yellow-100');
      });
    });

    it('should display risk level indicators', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('risk-low')).toBeInTheDocument();
        expect(screen.getByTestId('risk-medium')).toBeInTheDocument();
      });
    });

    it('should show renewal indicators for contracts', async () => {
      renderComponent();
      
      await waitFor(() => {
        const renewalIndicator = screen.getByTestId('renewal-indicator-contract1');
        expect(renewalIndicator).toBeInTheDocument();
        expect(renewalIndicator).toHaveTextContent('Renewal: Nov 1, 2024');
      });
    });

    it('should toggle between grid and list views', async () => {
      renderComponent();
      
      const viewToggle = screen.getByRole('button', { name: /grid view/i });
      fireEvent.click(viewToggle);
      
      await waitFor(() => {
        expect(screen.getByTestId('contracts-grid')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering and Sorting', () => {
    it('should display filter controls', () => {
      renderComponent();
      
      expect(screen.getByTestId('filter-sort-controls')).toBeInTheDocument();
    });

    it('should filter contracts by status', async () => {
      renderComponent();
      
      const statusFilter = screen.getByLabelText('Status filter');
      fireEvent.change(statusFilter, { target: { value: 'active' } });
      
      await waitFor(() => {
        expect(screen.getByText('CON-2024-001')).toBeInTheDocument();
        expect(screen.queryByText('CON-2024-003')).not.toBeInTheDocument();
      });
    });

    it('should filter by contract type', async () => {
      renderComponent();
      
      const typeFilter = screen.getByLabelText('Type filter');
      fireEvent.change(typeFilter, { target: { value: 'NDA' } });
      
      await waitFor(() => {
        expect(screen.getByText('CON-2024-003')).toBeInTheDocument();
        expect(screen.queryByText('CON-2024-001')).not.toBeInTheDocument();
      });
    });

    it('should filter by date range', async () => {
      renderComponent();
      
      const startDate = screen.getByLabelText('Start date');
      const endDate = screen.getByLabelText('End date');
      
      fireEvent.change(startDate, { target: { value: '2024-01-01' } });
      fireEvent.change(endDate, { target: { value: '2024-06-30' } });
      
      await waitFor(() => {
        expect(screen.getByText('CON-2024-001')).toBeInTheDocument();
      });
    });

    it('should sort contracts by different columns', async () => {
      renderComponent();
      
      const valueHeader = screen.getByRole('columnheader', { name: /value/i });
      fireEvent.click(valueHeader);
      
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        expect(rows[1]).toHaveTextContent('CON-2024-001'); // Highest value first
      });
    });

    it('should search contracts by text', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search contracts...');
      await userEvent.type(searchInput, 'Service Agreement');
      
      await waitFor(() => {
        expect(screen.getByText('CON-2024-001')).toBeInTheDocument();
        expect(screen.queryByText('CON-2024-002')).not.toBeInTheDocument();
      });
    });

    it('should clear all filters', async () => {
      renderComponent();
      
      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      fireEvent.click(clearButton);
      
      await waitFor(() => {
        expect(screen.getAllByRole('row')).toHaveLength(4); // Header + 3 contracts
      });
    });
  });

  describe('Selection and Bulk Operations', () => {
    it('should select individual contracts', async () => {
      renderComponent();
      
      await waitFor(() => {
        const checkbox1 = screen.getByRole('checkbox', { name: /select CON-2024-001/i });
        fireEvent.click(checkbox1);
      });
      
      expect(screen.getByTestId('bulk-operations-bar')).toHaveTextContent('Selected: 1');
    });

    it('should select all contracts', async () => {
      renderComponent();
      
      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });
      fireEvent.click(selectAllCheckbox);
      
      await waitFor(() => {
        expect(screen.getByTestId('bulk-operations-bar')).toHaveTextContent('Selected: 3');
      });
    });

    it('should show bulk operations bar when items selected', async () => {
      renderComponent();
      
      const checkbox = screen.getByRole('checkbox', { name: /select CON-2024-001/i });
      fireEvent.click(checkbox);
      
      await waitFor(() => {
        expect(screen.getByTestId('bulk-operations-bar')).toBeInTheDocument();
      });
    });

    it('should perform bulk export', async () => {
      renderComponent();
      
      const checkbox = screen.getByRole('checkbox', { name: /select CON-2024-001/i });
      fireEvent.click(checkbox);
      
      const exportButton = screen.getByRole('button', { name: /export selected/i });
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Export started/i)).toBeInTheDocument();
      });
    });

    it('should perform bulk status update', async () => {
      renderComponent();
      
      const checkbox1 = screen.getByRole('checkbox', { name: /select CON-2024-001/i });
      const checkbox2 = screen.getByRole('checkbox', { name: /select CON-2024-002/i });
      fireEvent.click(checkbox1);
      fireEvent.click(checkbox2);
      
      const bulkStatusButton = screen.getByRole('button', { name: /change status/i });
      fireEvent.click(bulkStatusButton);
      
      const statusOption = screen.getByRole('option', { name: /approved/i });
      fireEvent.click(statusOption);
      
      await waitFor(() => {
        expect(screen.getByText(/2 contracts updated/i)).toBeInTheDocument();
      });
    });
  });

  describe('Contract Actions', () => {
    it('should navigate to contract details on row click', async () => {
      renderComponent();
      
      await waitFor(() => {
        const contractRow = screen.getByTestId('contract-row-contract1');
        fireEvent.click(contractRow);
      });
      
      expect(window.location.pathname).toBe('/contracts/contract1');
    });

    it('should open contract in new tab with middle click', async () => {
      renderComponent();
      
      const openInNewTab = vi.fn();
      window.open = openInNewTab;
      
      const contractRow = screen.getByTestId('contract-row-contract1');
      fireEvent.mouseDown(contractRow, { button: 1 });
      
      expect(openInNewTab).toHaveBeenCalledWith('/contracts/contract1', '_blank');
    });

    it('should show action menu for each contract', async () => {
      renderComponent();
      
      await waitFor(() => {
        const menuButton = screen.getByTestId('contract-menu-contract1');
        fireEvent.click(menuButton);
      });
      
      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /duplicate/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
    });

    it('should handle contract edit action', async () => {
      renderComponent();
      
      const menuButton = screen.getByTestId('contract-menu-contract1');
      fireEvent.click(menuButton);
      
      const editButton = screen.getByRole('menuitem', { name: /edit/i });
      fireEvent.click(editButton);
      
      expect(window.location.pathname).toBe('/contracts/contract1/edit');
    });

    it('should handle contract duplicate action', async () => {
      renderComponent();
      
      const menuButton = screen.getByTestId('contract-menu-contract1');
      fireEvent.click(menuButton);
      
      const duplicateButton = screen.getByRole('menuitem', { name: /duplicate/i });
      fireEvent.click(duplicateButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Contract duplicated successfully/i)).toBeInTheDocument();
      });
    });

    it('should confirm before deleting contract', async () => {
      renderComponent();
      
      const menuButton = screen.getByTestId('contract-menu-contract1');
      fireEvent.click(menuButton);
      
      const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
      fireEvent.click(deleteButton);
      
      expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Contract deleted successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('should display pagination controls', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
      });
    });

    it('should show items per page selector', () => {
      renderComponent();
      
      const perPageSelect = screen.getByLabelText('Items per page');
      expect(perPageSelect).toBeInTheDocument();
      expect(perPageSelect).toHaveValue('25');
    });

    it('should change items per page', async () => {
      renderComponent();
      
      const perPageSelect = screen.getByLabelText('Items per page');
      fireEvent.change(perPageSelect, { target: { value: '50' } });
      
      await waitFor(() => {
        expect(screen.getByText('1-50 of 156')).toBeInTheDocument();
      });
    });

    it('should navigate between pages', async () => {
      renderComponent();
      
      const nextButton = screen.getByRole('button', { name: /next page/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText('26-50 of 156')).toBeInTheDocument();
      });
    });

    it('should jump to specific page', async () => {
      renderComponent();
      
      const pageInput = screen.getByLabelText('Go to page');
      fireEvent.change(pageInput, { target: { value: '3' } });
      fireEvent.keyPress(pageInput, { key: 'Enter' });
      
      await waitFor(() => {
        expect(screen.getByText('51-75 of 156')).toBeInTheDocument();
      });
    });
  });

  describe('Create New Contract', () => {
    it('should open new contract dialog', () => {
      renderComponent();
      
      const newButton = screen.getByRole('button', { name: /new contract/i });
      fireEvent.click(newButton);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Create New Contract')).toBeInTheDocument();
    });

    it('should show contract type selection', () => {
      renderComponent();
      
      const newButton = screen.getByRole('button', { name: /new contract/i });
      fireEvent.click(newButton);
      
      expect(screen.getByLabelText('Contract type')).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /service agreement/i })).toBeInTheDocument();
    });

    it('should navigate to create page with template', () => {
      renderComponent();
      
      const newButton = screen.getByRole('button', { name: /new contract/i });
      fireEvent.click(newButton);
      
      const typeSelect = screen.getByLabelText('Contract type');
      fireEvent.change(typeSelect, { target: { value: 'service_agreement' } });
      
      const createButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(createButton);
      
      expect(window.location.pathname).toBe('/contracts/new');
      expect(window.location.search).toContain('type=service_agreement');
    });
  });

  describe('Import Contracts', () => {
    it('should open import dialog', () => {
      renderComponent();
      
      const importButton = screen.getByRole('button', { name: /import/i });
      fireEvent.click(importButton);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Import Contracts')).toBeInTheDocument();
    });

    it('should show file upload area', () => {
      renderComponent();
      
      const importButton = screen.getByRole('button', { name: /import/i });
      fireEvent.click(importButton);
      
      expect(screen.getByText(/Drag and drop files/i)).toBeInTheDocument();
      expect(screen.getByLabelText('File input')).toBeInTheDocument();
    });

    it('should accept CSV and Excel files', () => {
      renderComponent();
      
      const importButton = screen.getByRole('button', { name: /import/i });
      fireEvent.click(importButton);
      
      const fileInput = screen.getByLabelText('File input');
      expect(fileInput).toHaveAttribute('accept', '.csv,.xlsx,.xls');
    });

    it('should show import preview', async () => {
      renderComponent();
      
      const importButton = screen.getByRole('button', { name: /import/i });
      fireEvent.click(importButton);
      
      const file = new File(['contract data'], 'contracts.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText('File input');
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(fileInput);
      
      await waitFor(() => {
        expect(screen.getByText('Preview: contracts.csv')).toBeInTheDocument();
      });
    });
  });

  describe('Export Contracts', () => {
    it('should show export options', () => {
      renderComponent();
      
      const exportButton = screen.getByRole('button', { name: /export all/i });
      fireEvent.click(exportButton);
      
      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /csv/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /excel/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /pdf/i })).toBeInTheDocument();
    });

    it('should export to CSV format', async () => {
      renderComponent();
      
      const exportButton = screen.getByRole('button', { name: /export all/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByRole('menuitem', { name: /csv/i });
      fireEvent.click(csvOption);
      
      await waitFor(() => {
        expect(screen.getByText(/Export completed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading and Error States', () => {
    it('should show loading state', () => {
      renderComponent();
      
      expect(screen.getByTestId('contracts-loading')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should handle load error', async () => {
      renderComponent();
      
      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        fireEvent.click(retryButton);
      });
      
      expect(screen.getByText(/Failed to load contracts/i)).toBeInTheDocument();
    });

    it('should show empty state when no contracts', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        expect(screen.getByText(/No contracts found/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /create first contract/i })).toBeInTheDocument();
      });
    });
  });

  describe('Permissions', () => {
    it('should hide create button without permission', () => {
      (useAuthStore as any).mockReturnValue({
        user: { ...mockUser, permissions: ['view_contracts'] },
        isAuthenticated: true,
      });
      
      renderComponent();
      
      expect(screen.queryByRole('button', { name: /new contract/i })).not.toBeInTheDocument();
    });

    it('should disable edit actions without permission', async () => {
      (useAuthStore as any).mockReturnValue({
        user: { ...mockUser, permissions: ['view_contracts'] },
        isAuthenticated: true,
      });
      
      renderComponent();
      
      await waitFor(() => {
        const menuButton = screen.getByTestId('contract-menu-contract1');
        fireEvent.click(menuButton);
      });
      
      expect(screen.queryByRole('menuitem', { name: /edit/i })).not.toBeInTheDocument();
    });

    it('should disable delete actions without permission', async () => {
      (useAuthStore as any).mockReturnValue({
        user: { ...mockUser, permissions: ['view_contracts', 'edit_contracts'] },
        isAuthenticated: true,
      });
      
      renderComponent();
      
      await waitFor(() => {
        const menuButton = screen.getByTestId('contract-menu-contract1');
        fireEvent.click(menuButton);
      });
      
      expect(screen.queryByRole('menuitem', { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile view', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      renderComponent();
      
      expect(screen.getByTestId('contracts-list-page')).toHaveClass('mobile-view');
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getByTestId('contracts-cards')).toBeInTheDocument();
    });

    it('should show mobile menu', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      renderComponent();
      
      const menuButton = screen.getByRole('button', { name: /menu/i });
      fireEvent.click(menuButton);
      
      expect(screen.getByTestId('mobile-menu')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Contracts list');
      expect(screen.getByRole('table')).toHaveAttribute('aria-label', 'Contracts table');
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      await waitFor(() => {
        const firstRow = screen.getByTestId('contract-row-contract1');
        firstRow.focus();
        
        fireEvent.keyDown(firstRow, { key: 'Enter' });
        
        expect(window.location.pathname).toBe('/contracts/contract1');
      });
    });

    it('should announce updates to screen readers', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search contracts...');
      await userEvent.type(searchInput, 'Service');
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/1 contract found/i);
      });
    });
  });
});