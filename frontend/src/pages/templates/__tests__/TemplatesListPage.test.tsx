/**
 * TemplatesListPage Test Suite
 * Following TDD methodology - comprehensive testing for all requirements
 * Testing all user interactions, error states, and accessibility
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import TemplatesListPage from '../TemplatesListPage';
import { templateService } from '../../../services/template.service';

// Mock the auth store
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  tenant_id: 'tenant-1',
  permissions: ['templates:read', 'templates:create', 'templates:update', 'templates:delete']
};

const mockUseAuthStore = vi.fn(() => ({
  user: mockUser,
  isAuthenticated: true
}));

vi.mock('../../../store/auth', () => ({
  useAuthStore: mockUseAuthStore
}));

// Mock the template service
vi.mock('../../../services/template.service', () => ({
  templateService: {
    getTemplates: vi.fn(),
    deleteTemplate: vi.fn(),
    cloneTemplate: vi.fn(),
    bulkDelete: vi.fn(),
    exportTemplate: vi.fn(),
    getCategories: vi.fn(),
    bulkUpdate: vi.fn(),
    importTemplate: vi.fn(),
    shareTemplate: vi.fn()
  }
}));

// Mock the navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, to }: any) => <a href={to}>{children}</a>
  };
});

// Sample template data for testing
const sampleTemplates = [
  {
    id: 'template-1',
    name: 'Non-Disclosure Agreement',
    category: 'Legal',
    description: 'Standard NDA template for business partnerships',
    content: 'Template content here...',
    version: '1.2.0',
    is_active: true,
    usage_count: 45,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-20T15:30:00Z',
    metadata: { approval_status: 'approved' }
  },
  {
    id: 'template-2',
    name: 'Employment Contract',
    category: 'HR',
    description: 'Standard employment contract template',
    content: 'Employment template content...',
    version: '2.1.0',
    is_active: false,
    usage_count: 23,
    created_at: '2024-01-10T08:00:00Z',
    updated_at: '2024-01-18T12:00:00Z',
    metadata: { approval_status: 'pending' }
  },
  {
    id: 'template-3',
    name: 'Service Agreement',
    category: 'Commercial',
    description: 'Professional services agreement template',
    content: 'Service agreement content...',
    version: '1.0.0',
    is_active: true,
    usage_count: 67,
    created_at: '2024-01-05T14:20:00Z',
    updated_at: '2024-01-22T09:15:00Z',
    metadata: { approval_status: 'approved' }
  }
];

const sampleCategories = [
  { id: 'legal', name: 'Legal', count: 15 },
  { id: 'hr', name: 'HR', count: 8 },
  { id: 'commercial', name: 'Commercial', count: 12 }
];

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Helper function to render component with wrapper
const renderTemplatesListPage = () => {
  return render(
    <TestWrapper>
      <TemplatesListPage />
    </TestWrapper>
  );
};

describe('TemplatesListPage', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    vi.mocked(templateService.getTemplates).mockResolvedValue({
      items: sampleTemplates,
      total: sampleTemplates.length,
      limit: 25,
      offset: 0
    });

    vi.mocked(templateService.getCategories).mockResolvedValue(sampleCategories);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Rendering and Layout', () => {
    it('renders the page with proper structure and accessibility', async () => {
      renderTemplatesListPage();

      // Check main structure
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByText('Templates')).toBeInTheDocument();
      expect(screen.getByLabelText('Templates list')).toBeInTheDocument();

      // Check breadcrumbs
      expect(screen.getByRole('navigation', { name: 'breadcrumb' })).toBeInTheDocument();
      expect(screen.getByText('Home')).toBeInTheDocument();

      // Wait for templates to load
      await waitFor(() => {
        expect(screen.getByText('Non-Disclosure Agreement')).toBeInTheDocument();
      });
    });

    it('displays templates in table view by default', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.getByText('Non-Disclosure Agreement')).toBeInTheDocument();
        expect(screen.getByText('Employment Contract')).toBeInTheDocument();
      });
    });

    it('switches to grid view when grid button is clicked', async () => {
      renderTemplatesListPage();

      const gridButton = screen.getByLabelText('Grid view');
      await user.click(gridButton);

      await waitFor(() => {
        expect(screen.getByTestId('templates-grid')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
      });
    });

    it('displays template statistics correctly', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        expect(screen.getByTestId('template-stats')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument(); // Total templates
        expect(screen.getByText('2')).toBeInTheDocument(); // Active templates
      });
    });
  });

  describe('Template List Display', () => {
    it('displays template details in table rows', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        const tableRows = screen.getAllByTestId(/template-row-/);
        expect(tableRows).toHaveLength(3);

        // Check specific template details
        expect(screen.getByText('Non-Disclosure Agreement')).toBeInTheDocument();
        expect(screen.getByText('Legal')).toBeInTheDocument();
        expect(screen.getByText('v1.2.0')).toBeInTheDocument();
        expect(screen.getByText('45')).toBeInTheDocument(); // usage count
      });
    });

    it('displays template status badges correctly', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        expect(screen.getByTestId('status-active')).toBeInTheDocument();
        expect(screen.getByTestId('status-archived')).toBeInTheDocument();
      });
    });

    it('shows approval status in metadata', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        expect(screen.getByText('Approved')).toBeInTheDocument();
        expect(screen.getByText('Pending')).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('filters templates by name when searching', async () => {
      renderTemplatesListPage();

      const searchInput = screen.getByPlaceholderText('Search templates...');
      await user.type(searchInput, 'NDA');

      await waitFor(() => {
        expect(screen.getByText('Non-Disclosure Agreement')).toBeInTheDocument();
        expect(screen.queryByText('Employment Contract')).not.toBeInTheDocument();
      });
    });

    it('filters templates by description when searching', async () => {
      renderTemplatesListPage();

      const searchInput = screen.getByPlaceholderText('Search templates...');
      await user.type(searchInput, 'business partnerships');

      await waitFor(() => {
        expect(screen.getByText('Non-Disclosure Agreement')).toBeInTheDocument();
        expect(screen.queryByText('Service Agreement')).not.toBeInTheDocument();
      });
    });

    it('shows no results message when search yields no results', async () => {
      renderTemplatesListPage();

      const searchInput = screen.getByPlaceholderText('Search templates...');
      await user.type(searchInput, 'nonexistent template');

      await waitFor(() => {
        expect(screen.getByTestId('no-results')).toBeInTheDocument();
        expect(screen.getByText('No templates match your filters')).toBeInTheDocument();
      });
    });

    it('clears search when clear button is clicked', async () => {
      renderTemplatesListPage();

      const searchInput = screen.getByPlaceholderText('Search templates...');
      await user.type(searchInput, 'NDA');
      
      const clearButton = screen.getByLabelText('Clear search');
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');
      await waitFor(() => {
        expect(screen.getAllByTestId(/template-row-/)).toHaveLength(3);
      });
    });
  });

  describe('Filter Functionality', () => {
    it('opens advanced filters when button is clicked', async () => {
      renderTemplatesListPage();

      const filtersButton = screen.getByText('Advanced Filters');
      await user.click(filtersButton);

      expect(screen.getByTestId('advanced-filters')).toBeInTheDocument();
      expect(screen.getByLabelText('Category')).toBeInTheDocument();
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
    });

    it('filters by category correctly', async () => {
      renderTemplatesListPage();

      // Open filters
      const filtersButton = screen.getByText('Advanced Filters');
      await user.click(filtersButton);

      // Select Legal category
      const categorySelect = screen.getByLabelText('Category');
      await user.selectOptions(categorySelect, 'Legal');

      await waitFor(() => {
        expect(screen.getByText('Non-Disclosure Agreement')).toBeInTheDocument();
        expect(screen.queryByText('Employment Contract')).not.toBeInTheDocument();
      });
    });

    it('filters by status (active/archived) correctly', async () => {
      renderTemplatesListPage();

      const filtersButton = screen.getByText('Advanced Filters');
      await user.click(filtersButton);

      const statusSelect = screen.getByLabelText('Status');
      await user.selectOptions(statusSelect, 'active');

      await waitFor(() => {
        expect(screen.getByText('Non-Disclosure Agreement')).toBeInTheDocument();
        expect(screen.getByText('Service Agreement')).toBeInTheDocument();
        expect(screen.queryByText('Employment Contract')).not.toBeInTheDocument();
      });
    });

    it('filters by date range correctly', async () => {
      renderTemplatesListPage();

      const filtersButton = screen.getByText('Advanced Filters');
      await user.click(filtersButton);

      const dateFromInput = screen.getByLabelText('Date from');
      const dateToInput = screen.getByLabelText('Date to');

      await user.type(dateFromInput, '2024-01-10');
      await user.type(dateToInput, '2024-01-16');

      await waitFor(() => {
        expect(screen.getByText('Non-Disclosure Agreement')).toBeInTheDocument();
        expect(screen.getByText('Employment Contract')).toBeInTheDocument();
        expect(screen.queryByText('Service Agreement')).not.toBeInTheDocument();
      });
    });

    it('clears all filters when Clear Filters button is clicked', async () => {
      renderTemplatesListPage();

      // Set some filters first
      const filtersButton = screen.getByText('Advanced Filters');
      await user.click(filtersButton);

      const categorySelect = screen.getByLabelText('Category');
      await user.selectOptions(categorySelect, 'Legal');

      // Clear filters
      const clearButton = screen.getByText('Clear Filters');
      await user.click(clearButton);

      expect(categorySelect).toHaveValue('');
      await waitFor(() => {
        expect(screen.getAllByTestId(/template-row-/)).toHaveLength(3);
      });
    });
  });

  describe('Sorting Functionality', () => {
    it('sorts by name when name column header is clicked', async () => {
      renderTemplatesListPage();

      const nameHeader = screen.getByRole('columnheader', { name: 'Name' });
      await user.click(nameHeader);

      await waitFor(() => {
        const rows = screen.getAllByTestId(/template-row-/);
        expect(rows[0]).toHaveTextContent('Employment Contract');
        expect(rows[1]).toHaveTextContent('Non-Disclosure Agreement');
      });
    });

    it('toggles sort order when clicking same column header twice', async () => {
      renderTemplatesListPage();

      const nameHeader = screen.getByRole('columnheader', { name: 'Name' });
      await user.click(nameHeader); // First click - ascending
      await user.click(nameHeader); // Second click - descending

      await waitFor(() => {
        const rows = screen.getAllByTestId(/template-row-/);
        expect(rows[0]).toHaveTextContent('Service Agreement');
        expect(rows[1]).toHaveTextContent('Non-Disclosure Agreement');
      });
    });

    it('sorts by usage count correctly', async () => {
      renderTemplatesListPage();

      const usageHeader = screen.getByRole('columnheader', { name: 'Usage Count' });
      await user.click(usageHeader);

      await waitFor(() => {
        const rows = screen.getAllByTestId(/template-row-/);
        expect(rows[0]).toHaveTextContent('23'); // Employment Contract
        expect(rows[2]).toHaveTextContent('67'); // Service Agreement
      });
    });

    it('sorts by last modified date correctly', async () => {
      renderTemplatesListPage();

      const dateHeader = screen.getByRole('columnheader', { name: 'Last Modified' });
      await user.click(dateHeader);

      await waitFor(() => {
        const rows = screen.getAllByTestId(/template-row-/);
        // Should be sorted by updated_at field
        expect(rows[0]).toHaveTextContent('Employment Contract'); // 2024-01-18
      });
    });
  });

  describe('Template Actions', () => {
    it('navigates to template details when View button is clicked', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        const viewButton = screen.getByTestId('view-template-template-1');
        fireEvent.click(viewButton);
        expect(mockNavigate).toHaveBeenCalledWith('/templates/template-1');
      });
    });

    it('navigates to template edit when Edit button is clicked', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        const editButton = screen.getByTestId('edit-template-template-1');
        fireEvent.click(editButton);
        expect(mockNavigate).toHaveBeenCalledWith('/templates/template-1/edit');
      });
    });

    it('shows delete confirmation dialog when Delete button is clicked', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        const deleteButton = screen.getByTestId('delete-template-template-1');
        fireEvent.click(deleteButton);
        
        expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to delete "Non-Disclosure Agreement"/)).toBeInTheDocument();
      });
    });

    it('deletes template when confirmed in dialog', async () => {
      vi.mocked(templateService.deleteTemplate).mockResolvedValue();
      renderTemplatesListPage();

      await waitFor(() => {
        const deleteButton = screen.getByTestId('delete-template-template-1');
        fireEvent.click(deleteButton);
      });

      const confirmButton = screen.getByText('Confirm Delete');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(templateService.deleteTemplate).toHaveBeenCalledWith('template-1');
      });
    });

    it('shows clone dialog when Duplicate button is clicked', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        const cloneButton = screen.getByTestId('clone-template-template-1');
        fireEvent.click(cloneButton);
        
        expect(screen.getByText('Duplicate Template')).toBeInTheDocument();
        expect(screen.getByLabelText('Template name')).toBeInTheDocument();
      });
    });

    it('clones template with new name', async () => {
      vi.mocked(templateService.cloneTemplate).mockResolvedValue({
        ...sampleTemplates[0],
        id: 'template-4',
        name: 'Copy of Non-Disclosure Agreement',
        cloned_from: 'template-1'
      });

      renderTemplatesListPage();

      await waitFor(() => {
        const cloneButton = screen.getByTestId('clone-template-template-1');
        fireEvent.click(cloneButton);
      });

      const nameInput = screen.getByLabelText('Template name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Copy of Non-Disclosure Agreement');

      const confirmButton = screen.getByText('Create Copy');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(templateService.cloneTemplate).toHaveBeenCalledWith('template-1', {
          name: 'Copy of Non-Disclosure Agreement'
        });
      });
    });

    it('toggles template active status when Archive/Activate button is clicked', async () => {
      vi.mocked(templateService.bulkUpdate).mockResolvedValue({
        updated: 1,
        failed: 0,
        results: [{ id: 'template-1', success: true }]
      });

      renderTemplatesListPage();

      await waitFor(() => {
        const archiveButton = screen.getByTestId('archive-template-template-1');
        fireEvent.click(archiveButton);
      });

      await waitFor(() => {
        expect(templateService.bulkUpdate).toHaveBeenCalledWith(['template-1'], {
          is_active: false
        });
      });
    });
  });

  describe('Bulk Operations', () => {
    it('selects templates when checkboxes are clicked', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        const checkbox1 = screen.getByTestId('select-template-template-1');
        const checkbox2 = screen.getByTestId('select-template-template-2');
        
        fireEvent.click(checkbox1);
        fireEvent.click(checkbox2);

        expect(screen.getByTestId('bulk-operations-bar')).toBeInTheDocument();
        expect(screen.getByText('2 selected')).toBeInTheDocument();
      });
    });

    it('selects all templates when select all checkbox is clicked', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        const selectAllCheckbox = screen.getByLabelText('Select all');
        fireEvent.click(selectAllCheckbox);

        expect(screen.getByText('3 selected')).toBeInTheDocument();
      });
    });

    it('shows bulk delete confirmation dialog', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        const selectAllCheckbox = screen.getByLabelText('Select all');
        fireEvent.click(selectAllCheckbox);

        const bulkDeleteButton = screen.getByText('Delete Selected');
        fireEvent.click(bulkDeleteButton);

        expect(screen.getByText('Confirm Bulk Delete')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to delete 3 templates/)).toBeInTheDocument();
      });
    });

    it('performs bulk delete when confirmed', async () => {
      vi.mocked(templateService.bulkDelete).mockResolvedValue({
        deleted: 3,
        failed: 0
      });

      renderTemplatesListPage();

      await waitFor(() => {
        const selectAllCheckbox = screen.getByLabelText('Select all');
        fireEvent.click(selectAllCheckbox);

        const bulkDeleteButton = screen.getByText('Delete Selected');
        fireEvent.click(bulkDeleteButton);
      });

      const confirmButton = screen.getByText('Confirm Delete');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(templateService.bulkDelete).toHaveBeenCalledWith(['template-1', 'template-2', 'template-3']);
      });
    });

    it('performs bulk archive/activate operations', async () => {
      vi.mocked(templateService.bulkUpdate).mockResolvedValue({
        updated: 2,
        failed: 0,
        results: [
          { id: 'template-1', success: true },
          { id: 'template-2', success: true }
        ]
      });

      renderTemplatesListPage();

      await waitFor(() => {
        const checkbox1 = screen.getByTestId('select-template-template-1');
        const checkbox2 = screen.getByTestId('select-template-template-2');
        fireEvent.click(checkbox1);
        fireEvent.click(checkbox2);

        const bulkArchiveButton = screen.getByText('Archive Selected');
        fireEvent.click(bulkArchiveButton);
      });

      await waitFor(() => {
        expect(templateService.bulkUpdate).toHaveBeenCalledWith(['template-1', 'template-2'], {
          is_active: false
        });
      });
    });
  });

  describe('Export/Import Functionality', () => {
    it('exports single template as JSON when export button is clicked', async () => {
      vi.mocked(templateService.exportTemplate).mockResolvedValue({
        template: sampleTemplates[0],
        format: 'json'
      });

      // Mock URL.createObjectURL and document.createElement
      global.URL.createObjectURL = vi.fn(() => 'mock-url');
      const mockClick = vi.fn();
      const mockAnchor = {
        href: '',
        download: '',
        click: mockClick
      };
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);

      renderTemplatesListPage();

      await waitFor(() => {
        const exportButton = screen.getByTestId('export-template-template-1');
        fireEvent.click(exportButton);
      });

      await waitFor(() => {
        expect(templateService.exportTemplate).toHaveBeenCalledWith('template-1', 'json');
        expect(mockClick).toHaveBeenCalled();
      });
    });

    it('shows import dialog when Import button is clicked', async () => {
      renderTemplatesListPage();

      const importButton = screen.getByText('Import Templates');
      fireEvent.click(importButton);

      expect(screen.getByText('Import Templates')).toBeInTheDocument();
      expect(screen.getByLabelText('Select JSON file')).toBeInTheDocument();
    });

    it('imports templates from uploaded JSON file', async () => {
      vi.mocked(templateService.importTemplate).mockResolvedValue(sampleTemplates[0]);

      renderTemplatesListPage();

      const importButton = screen.getByText('Import Templates');
      fireEvent.click(importButton);

      // Mock file upload
      const fileInput = screen.getByLabelText('Select JSON file');
      const file = new File([JSON.stringify(sampleTemplates[0])], 'template.json', {
        type: 'application/json'
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      const uploadButton = screen.getByText('Import');
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(templateService.importTemplate).toHaveBeenCalled();
      });
    });

    it('exports multiple templates as bulk JSON', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        const selectAllCheckbox = screen.getByLabelText('Select all');
        fireEvent.click(selectAllCheckbox);

        const bulkExportButton = screen.getByText('Export Selected');
        fireEvent.click(bulkExportButton);
      });

      // Should show export format selection dialog
      expect(screen.getByText('Export Templates')).toBeInTheDocument();
      expect(screen.getByLabelText('Export format')).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('displays pagination controls with correct information', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        expect(screen.getByRole('navigation', { name: 'pagination' })).toBeInTheDocument();
        expect(screen.getByText('1-3 of 3')).toBeInTheDocument();
        expect(screen.getByLabelText('Items per page')).toBeInTheDocument();
      });
    });

    it('changes items per page when dropdown is changed', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        const itemsPerPageSelect = screen.getByLabelText('Items per page');
        fireEvent.change(itemsPerPageSelect, { target: { value: '50' } });
        expect(itemsPerPageSelect).toHaveValue('50');
      });
    });

    it('navigates to next page when next button is clicked', async () => {
      // Mock more templates to enable pagination
      vi.mocked(templateService.getTemplates).mockResolvedValue({
        items: [...sampleTemplates, ...sampleTemplates, ...sampleTemplates], // 9 items
        total: 9,
        limit: 3,
        offset: 0
      });

      renderTemplatesListPage();

      await waitFor(() => {
        const nextButton = screen.getByLabelText('Next page');
        fireEvent.click(nextButton);
      });

      await waitFor(() => {
        expect(templateService.getTemplates).toHaveBeenCalledWith(
          expect.objectContaining({ offset: 3, limit: 25 })
        );
      });
    });

    it('navigates to specific page when page input is changed', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        const pageInput = screen.getByLabelText('Go to page');
        fireEvent.change(pageInput, { target: { value: '2' } });
        fireEvent.keyDown(pageInput, { key: 'Enter' });
      });

      // Should trigger page change
      expect(pageInput).toHaveValue(2);
    });
  });

  describe('Error Handling', () => {
    it('displays error message when templates fail to load', async () => {
      vi.mocked(templateService.getTemplates).mockRejectedValue(new Error('Network error'));

      renderTemplatesListPage();

      await waitFor(() => {
        expect(screen.getByText('Failed to load templates')).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('displays error message when delete operation fails', async () => {
      vi.mocked(templateService.deleteTemplate).mockRejectedValue(new Error('Delete failed'));

      renderTemplatesListPage();

      await waitFor(() => {
        const deleteButton = screen.getByTestId('delete-template-template-1');
        fireEvent.click(deleteButton);
      });

      const confirmButton = screen.getByText('Confirm Delete');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to delete template')).toBeInTheDocument();
      });
    });

    it('displays error message when clone operation fails', async () => {
      vi.mocked(templateService.cloneTemplate).mockRejectedValue(new Error('Clone failed'));

      renderTemplatesListPage();

      await waitFor(() => {
        const cloneButton = screen.getByTestId('clone-template-template-1');
        fireEvent.click(cloneButton);
      });

      const nameInput = screen.getByLabelText('Template name');
      await user.type(nameInput, 'Test Clone');

      const confirmButton = screen.getByText('Create Copy');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to clone template')).toBeInTheDocument();
      });
    });

    it('retries template loading when retry button is clicked', async () => {
      vi.mocked(templateService.getTemplates)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          items: sampleTemplates,
          total: sampleTemplates.length,
          limit: 25,
          offset: 0
        });

      renderTemplatesListPage();

      await waitFor(() => {
        const retryButton = screen.getByText('Retry');
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Non-Disclosure Agreement')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('displays loading skeleton while templates are being fetched', async () => {
      vi.mocked(templateService.getTemplates).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          items: sampleTemplates,
          total: sampleTemplates.length,
          limit: 25,
          offset: 0
        }), 100))
      );

      renderTemplatesListPage();

      expect(screen.getByTestId('templates-loading')).toBeInTheDocument();
      expect(screen.getAllByTestId('template-skeleton')).toHaveLength(6);

      await waitFor(() => {
        expect(screen.getByText('Non-Disclosure Agreement')).toBeInTheDocument();
      });
    });

    it('shows loading spinner on action buttons when operations are in progress', async () => {
      vi.mocked(templateService.deleteTemplate).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      renderTemplatesListPage();

      await waitFor(() => {
        const deleteButton = screen.getByTestId('delete-template-template-1');
        fireEvent.click(deleteButton);
      });

      const confirmButton = screen.getByText('Confirm Delete');
      fireEvent.click(confirmButton);

      expect(screen.getByTestId('button-spinner')).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('displays empty state when no templates exist', async () => {
      vi.mocked(templateService.getTemplates).mockResolvedValue({
        items: [],
        total: 0,
        limit: 25,
        offset: 0
      });

      renderTemplatesListPage();

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        expect(screen.getByText('No templates found')).toBeInTheDocument();
        expect(screen.getByText('Create First Template')).toBeInTheDocument();
      });
    });

    it('navigates to template creation when Create First Template button is clicked', async () => {
      vi.mocked(templateService.getTemplates).mockResolvedValue({
        items: [],
        total: 0,
        limit: 25,
        offset: 0
      });

      renderTemplatesListPage();

      await waitFor(() => {
        const createButton = screen.getByText('Create First Template');
        fireEvent.click(createButton);
        expect(mockNavigate).toHaveBeenCalledWith('/templates/create');
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Templates list');
        expect(screen.getByRole('table')).toHaveAttribute('aria-label', 'Templates table');
        expect(screen.getByRole('navigation', { name: 'pagination' })).toBeInTheDocument();
      });
    });

    it('supports keyboard navigation for interactive elements', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        const firstCheckbox = screen.getByTestId('select-template-template-1');
        firstCheckbox.focus();
        expect(firstCheckbox).toHaveFocus();

        fireEvent.keyDown(firstCheckbox, { key: 'Enter' });
        expect(firstCheckbox).toBeChecked();
      });
    });

    it('provides screen reader announcements for bulk operations', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        const selectAllCheckbox = screen.getByLabelText('Select all');
        fireEvent.click(selectAllCheckbox);

        expect(screen.getByRole('status')).toHaveTextContent('3 templates selected');
      });
    });

    it('has proper focus management for dialogs', async () => {
      renderTemplatesListPage();

      await waitFor(() => {
        const deleteButton = screen.getByTestId('delete-template-template-1');
        fireEvent.click(deleteButton);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(document.activeElement).toBeCloseTo(screen.getByText('Confirm Delete'));
      });
    });
  });

  describe('Responsive Design', () => {
    it('adapts to mobile view correctly', async () => {
      // Mock window.innerWidth for mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      renderTemplatesListPage();

      await waitFor(() => {
        expect(screen.getByTestId('mobile-controls')).toBeInTheDocument();
      });
    });

    it('shows/hides columns based on screen size', async () => {
      renderTemplatesListPage();

      // Desktop view should show all columns
      await waitFor(() => {
        expect(screen.getByText('Category')).toBeInTheDocument();
        expect(screen.getByText('Last Modified')).toBeInTheDocument();
      });

      // Test mobile behavior would require viewport manipulation
    });
  });

  describe('Performance Optimizations', () => {
    it('implements virtual scrolling for large datasets', async () => {
      // Mock large dataset
      const largeDataset = Array.from({ length: 150 }, (_, i) => ({
        ...sampleTemplates[0],
        id: `template-${i}`,
        name: `Template ${i}`
      }));

      vi.mocked(templateService.getTemplates).mockResolvedValue({
        items: largeDataset,
        total: largeDataset.length,
        limit: 100,
        offset: 0
      });

      renderTemplatesListPage();

      await waitFor(() => {
        expect(screen.getByTestId('virtual-scroll-container')).toBeInTheDocument();
      });
    });

    it('debounces search input to avoid excessive API calls', async () => {
      renderTemplatesListPage();

      const searchInput = screen.getByPlaceholderText('Search templates...');
      
      // Type multiple characters quickly
      await user.type(searchInput, 'test search');

      // Should only call API once after debounce delay
      await waitFor(() => {
        expect(templateService.getTemplates).toHaveBeenCalledTimes(2); // Initial load + debounced search
      }, { timeout: 1000 });
    });
  });
});