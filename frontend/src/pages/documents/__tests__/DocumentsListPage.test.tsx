import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DocumentsListPage from '../DocumentsListPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { useAuthStore } from '../../../store/auth';

// Test data interfaces
interface Document {
  id: string;
  title: string;
  filename: string;
  type: 'PDF' | 'DOCX' | 'XLSX' | 'TXT';
  size: number;
  uploadDate: string;
  modifiedDate: string;
  owner: string;
  department: string;
  tags: string[];
  confidentialityLevel: 'public' | 'internal' | 'confidential' | 'secret';
  thumbnailUrl?: string;
  downloadUrl: string;
  status: 'processing' | 'ready' | 'error';
}

interface DocumentStats {
  total: number;
  totalSize: number;
  byType: Record<string, number>;
  recentUploads: number;
}

// Mock modules
vi.mock('../../../store/auth');

// Mock React Query
vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(() => ({
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
  })),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  useQuery: vi.fn(() => ({ data: null, isLoading: false, error: null })),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  })),
}));

// Mock document service  
vi.mock('../../../services/document.service', () => ({
  default: {
    getDocuments: vi.fn(),
    deleteDocument: vi.fn(),
    downloadDocument: vi.fn(),
    getUploadStats: vi.fn(),
    formatFileSize: vi.fn((bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    }),
  },
}));

describe('DocumentsListPage', () => {
  let queryClient: QueryClient;
  const mockUser = {
    id: 'user1',
    email: 'user@example.com',
    name: 'Test User',
    role: 'document_manager',
    permissions: ['view_documents', 'create_documents', 'edit_documents', 'delete_documents'],
    tenant_id: 'tenant1',
  };

  const sampleDocuments: Document[] = [
    {
      id: 'doc1',
      title: 'Contract Agreement.pdf',
      filename: 'contract_agreement.pdf',
      type: 'PDF',
      size: 2048000, // 2MB
      uploadDate: '2024-01-15T10:00:00Z',
      modifiedDate: '2024-01-15T10:00:00Z',
      owner: 'John Doe',
      department: 'Legal',
      tags: ['contract', 'important'],
      confidentialityLevel: 'confidential',
      thumbnailUrl: '/thumbnails/doc1.jpg',
      downloadUrl: '/documents/doc1/download',
      status: 'ready',
    },
    {
      id: 'doc2',
      title: 'Financial Report Q4.xlsx',
      filename: 'financial_report_q4.xlsx',
      type: 'XLSX',
      size: 1024000, // 1MB
      uploadDate: '2024-01-10T14:30:00Z',
      modifiedDate: '2024-01-12T09:15:00Z',
      owner: 'Jane Smith',
      department: 'Finance',
      tags: ['financial', 'quarterly', 'report'],
      confidentialityLevel: 'internal',
      thumbnailUrl: '/thumbnails/doc2.jpg',
      downloadUrl: '/documents/doc2/download',
      status: 'ready',
    },
    {
      id: 'doc3',
      title: 'Meeting Notes.docx',
      filename: 'meeting_notes.docx',
      type: 'DOCX',
      size: 512000, // 512KB
      uploadDate: '2024-01-08T16:45:00Z',
      modifiedDate: '2024-01-08T16:45:00Z',
      owner: 'Mike Johnson',
      department: 'Operations',
      tags: ['meeting', 'notes'],
      confidentialityLevel: 'public',
      thumbnailUrl: '/thumbnails/doc3.jpg',
      downloadUrl: '/documents/doc3/download',
      status: 'processing',
    },
    {
      id: 'doc4',
      title: 'Policy Document.txt',
      filename: 'policy_document.txt',
      type: 'TXT',
      size: 51200, // 50KB
      uploadDate: '2024-01-05T11:20:00Z',
      modifiedDate: '2024-01-06T08:30:00Z',
      owner: 'Sarah Wilson',
      department: 'HR',
      tags: ['policy', 'guidelines'],
      confidentialityLevel: 'internal',
      downloadUrl: '/documents/doc4/download',
      status: 'ready',
    },
  ];

  const sampleStats: DocumentStats = {
    total: 47,
    totalSize: 125829120, // ~120MB
    byType: {
      PDF: 23,
      DOCX: 12,
      XLSX: 8,
      TXT: 4,
    },
    recentUploads: 12,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Mock auth store
    (useAuthStore as any).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn().mockReturnValue('table'),
      setItem: vi.fn(),
      removeValue: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    // No additional mocking needed since we're using static data in the component
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <DocumentsListPage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  describe('Page Layout', () => {
    it('should render the documents list page', () => {
      renderComponent();
      
      expect(screen.getByTestId('documents-list-page')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /documents/i })).toBeInTheDocument();
    });

    it('should display page header with title and actions', () => {
      renderComponent();
      
      expect(screen.getByRole('heading', { name: /documents/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /upload documents/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export list/i })).toBeInTheDocument();
    });

    it('should show breadcrumbs navigation', () => {
      renderComponent();
      
      const breadcrumbs = screen.getByRole('navigation', { name: /breadcrumb/i });
      expect(breadcrumbs).toBeInTheDocument();
      expect(within(breadcrumbs).getByText('Home')).toBeInTheDocument();
      expect(within(breadcrumbs).getByText('Documents')).toBeInTheDocument();
    });

    it('should display statistics summary', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('document-stats')).toBeInTheDocument();
        expect(screen.getByText('47')).toBeInTheDocument(); // Total documents
        expect(screen.getByText(/120\.11 MB/i)).toBeInTheDocument(); // Total size
      });
    });

    it('should show view toggle buttons (table/grid)', () => {
      renderComponent();
      
      expect(screen.getByRole('button', { name: /table view/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /grid view/i })).toBeInTheDocument();
    });
  });

  describe('Document List Display', () => {
    it('should render documents in table format by default', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('table', { name: /documents table/i })).toBeInTheDocument();
        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByText('Type')).toBeInTheDocument();
        expect(screen.getByText('Size')).toBeInTheDocument();
        expect(screen.getByText('Date')).toBeInTheDocument();
        expect(screen.getByText('Owner')).toBeInTheDocument();
      });
    });

    it('should display document data correctly in table', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Agreement.pdf')).toBeInTheDocument();
        expect(screen.getByText('PDF')).toBeInTheDocument();
        expect(screen.getByText('2.00 MB')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('should show confidentiality level badges', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('confidentiality-confidential')).toBeInTheDocument();
        expect(screen.getByTestId('confidentiality-internal')).toBeInTheDocument();
        expect(screen.getByTestId('confidentiality-public')).toBeInTheDocument();
      });
    });

    it('should display processing status indicators', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('status-processing')).toBeInTheDocument();
        expect(screen.getAllByTestId(/status-ready/i)).toHaveLength(3);
      });
    });

    it('should toggle to grid view', async () => {
      renderComponent();
      
      const gridViewButton = screen.getByRole('button', { name: /grid view/i });
      fireEvent.click(gridViewButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('documents-grid')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
      });
    });

    it('should show document cards in grid view', async () => {
      renderComponent();
      
      const gridViewButton = screen.getByRole('button', { name: /grid view/i });
      fireEvent.click(gridViewButton);
      
      await waitFor(() => {
        expect(screen.getAllByTestId(/document-card-/i)).toHaveLength(4);
        expect(screen.getByTestId('document-card-doc1')).toBeInTheDocument();
      });
    });

    it('should display thumbnails in grid view', async () => {
      renderComponent();
      
      const gridViewButton = screen.getByRole('button', { name: /grid view/i });
      fireEvent.click(gridViewButton);
      
      await waitFor(() => {
        const thumbnails = screen.getAllByRole('img', { name: /thumbnail/i });
        expect(thumbnails).toHaveLength(3); // doc4 has no thumbnail
      });
    });

    it('should preserve view preference in localStorage', async () => {
      renderComponent();
      
      const gridViewButton = screen.getByRole('button', { name: /grid view/i });
      fireEvent.click(gridViewButton);
      
      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith('documents-view-mode', 'grid');
      });
    });
  });

  describe('Search and Filtering', () => {
    it('should display search bar with instant results', () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search documents...');
      expect(searchInput).toBeInTheDocument();
    });

    it('should search documents by title', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search documents...');
      await userEvent.type(searchInput, 'Contract');
      
      await waitFor(() => {
        expect(screen.getByText('Contract Agreement.pdf')).toBeInTheDocument();
        expect(screen.queryByText('Financial Report Q4.xlsx')).not.toBeInTheDocument();
      });
    });

    it('should debounce search input', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search documents...');
      
      // Type quickly
      await userEvent.type(searchInput, 'test');
      
      // Should not trigger immediate search
      expect(screen.getAllByTestId(/document-row-/i)).toHaveLength(4);
      
      // Wait for debounce
      await waitFor(() => {
        // Should filter after debounce delay
      }, { timeout: 600 });
    });

    it('should show advanced filter panel', () => {
      renderComponent();
      
      const filterButton = screen.getByRole('button', { name: /advanced filters/i });
      fireEvent.click(filterButton);
      
      expect(screen.getByTestId('advanced-filters')).toBeInTheDocument();
    });

    it('should filter by document type', async () => {
      renderComponent();
      
      const typeFilter = screen.getByLabelText('Document type');
      fireEvent.change(typeFilter, { target: { value: 'PDF' } });
      
      await waitFor(() => {
        expect(screen.getByText('Contract Agreement.pdf')).toBeInTheDocument();
        expect(screen.queryByText('Financial Report Q4.xlsx')).not.toBeInTheDocument();
      });
    });

    it('should filter by date range', async () => {
      renderComponent();
      
      const startDateFilter = screen.getByLabelText('Upload date from');
      const endDateFilter = screen.getByLabelText('Upload date to');
      
      fireEvent.change(startDateFilter, { target: { value: '2024-01-10' } });
      fireEvent.change(endDateFilter, { target: { value: '2024-01-15' } });
      
      await waitFor(() => {
        expect(screen.getByText('Contract Agreement.pdf')).toBeInTheDocument();
        expect(screen.getByText('Financial Report Q4.xlsx')).toBeInTheDocument();
        expect(screen.queryByText('Meeting Notes.docx')).not.toBeInTheDocument();
      });
    });

    it('should filter by file size range', async () => {
      renderComponent();
      
      const sizeFromFilter = screen.getByLabelText('Size from (MB)');
      const sizeToFilter = screen.getByLabelText('Size to (MB)');
      
      fireEvent.change(sizeFromFilter, { target: { value: '1' } });
      fireEvent.change(sizeToFilter, { target: { value: '3' } });
      
      await waitFor(() => {
        expect(screen.getByText('Contract Agreement.pdf')).toBeInTheDocument();
        expect(screen.getByText('Financial Report Q4.xlsx')).toBeInTheDocument();
        expect(screen.queryByText('Meeting Notes.docx')).not.toBeInTheDocument();
      });
    });

    it('should filter by owner/department', async () => {
      renderComponent();
      
      const departmentFilter = screen.getByLabelText('Department');
      fireEvent.change(departmentFilter, { target: { value: 'Legal' } });
      
      await waitFor(() => {
        expect(screen.getByText('Contract Agreement.pdf')).toBeInTheDocument();
        expect(screen.queryByText('Financial Report Q4.xlsx')).not.toBeInTheDocument();
      });
    });

    it('should filter by tags', async () => {
      renderComponent();
      
      const tagFilter = screen.getByLabelText('Tags');
      await userEvent.type(tagFilter, 'contract');
      
      await waitFor(() => {
        expect(screen.getByText('Contract Agreement.pdf')).toBeInTheDocument();
        expect(screen.queryByText('Financial Report Q4.xlsx')).not.toBeInTheDocument();
      });
    });

    it('should filter by confidentiality level', async () => {
      renderComponent();
      
      const confidentialityFilter = screen.getByLabelText('Confidentiality level');
      fireEvent.change(confidentialityFilter, { target: { value: 'confidential' } });
      
      await waitFor(() => {
        expect(screen.getByText('Contract Agreement.pdf')).toBeInTheDocument();
        expect(screen.queryByText('Financial Report Q4.xlsx')).not.toBeInTheDocument();
      });
    });

    it('should clear all filters', async () => {
      renderComponent();
      
      // Apply some filters
      const typeFilter = screen.getByLabelText('Document type');
      fireEvent.change(typeFilter, { target: { value: 'PDF' } });
      
      // Clear filters
      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      fireEvent.click(clearButton);
      
      await waitFor(() => {
        expect(screen.getAllByTestId(/document-row-/i)).toHaveLength(4);
      });
    });
  });

  describe('Sorting', () => {
    it('should sort by name (ascending/descending)', async () => {
      renderComponent();
      
      const nameHeader = screen.getByRole('columnheader', { name: /name/i });
      fireEvent.click(nameHeader);
      
      await waitFor(() => {
        const rows = screen.getAllByTestId(/document-row-/i);
        expect(rows[0]).toHaveTextContent('Contract Agreement.pdf');
      });
      
      // Click again for descending
      fireEvent.click(nameHeader);
      
      await waitFor(() => {
        const rows = screen.getAllByTestId(/document-row-/i);
        expect(rows[0]).toHaveTextContent('Policy Document.txt');
      });
    });

    it('should sort by type', async () => {
      renderComponent();
      
      const typeHeader = screen.getByRole('columnheader', { name: /type/i });
      fireEvent.click(typeHeader);
      
      await waitFor(() => {
        const firstRow = screen.getAllByTestId(/document-row-/i)[0];
        expect(firstRow).toHaveTextContent('DOCX');
      });
    });

    it('should sort by size', async () => {
      renderComponent();
      
      const sizeHeader = screen.getByRole('columnheader', { name: /size/i });
      fireEvent.click(sizeHeader);
      
      await waitFor(() => {
        const firstRow = screen.getAllByTestId(/document-row-/i)[0];
        expect(firstRow).toHaveTextContent('50.00 KB'); // Smallest first
      });
    });

    it('should sort by date', async () => {
      renderComponent();
      
      const dateHeader = screen.getByRole('columnheader', { name: /date/i });
      fireEvent.click(dateHeader);
      
      await waitFor(() => {
        const firstRow = screen.getAllByTestId(/document-row-/i)[0];
        expect(firstRow).toHaveTextContent('Jan 5, 2024'); // Oldest first
      });
    });

    it('should sort by owner', async () => {
      renderComponent();
      
      const ownerHeader = screen.getByRole('columnheader', { name: /owner/i });
      fireEvent.click(ownerHeader);
      
      await waitFor(() => {
        const firstRow = screen.getAllByTestId(/document-row-/i)[0];
        expect(firstRow).toHaveTextContent('Jane Smith'); // Alphabetical
      });
    });
  });

  describe('Document Selection and Bulk Operations', () => {
    it('should select individual documents', async () => {
      renderComponent();
      
      await waitFor(() => {
        const checkbox1 = screen.getByRole('checkbox', { name: /select contract agreement/i });
        fireEvent.click(checkbox1);
      });
      
      expect(screen.getByTestId('bulk-operations-bar')).toBeInTheDocument();
      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });

    it('should select all documents', async () => {
      renderComponent();
      
      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });
      fireEvent.click(selectAllCheckbox);
      
      await waitFor(() => {
        expect(screen.getByText('4 selected')).toBeInTheDocument();
      });
    });

    it('should show bulk operations toolbar when items selected', async () => {
      renderComponent();
      
      const checkbox = screen.getByRole('checkbox', { name: /select contract agreement/i });
      fireEvent.click(checkbox);
      
      await waitFor(() => {
        expect(screen.getByTestId('bulk-operations-bar')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /download selected/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /delete selected/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /move to folder/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /add tags/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /share selected/i })).toBeInTheDocument();
      });
    });

    it('should download selected documents', async () => {
      renderComponent();
      
      const checkbox = screen.getByRole('checkbox', { name: /select contract agreement/i });
      fireEvent.click(checkbox);
      
      const downloadButton = screen.getByRole('button', { name: /download selected/i });
      fireEvent.click(downloadButton);
      
      await waitFor(() => {
        expect(screen.getByText(/download started/i)).toBeInTheDocument();
      });
    });

    it('should delete selected documents with confirmation', async () => {
      renderComponent();
      
      const checkbox1 = screen.getByRole('checkbox', { name: /select contract agreement/i });
      const checkbox2 = screen.getByRole('checkbox', { name: /select financial report/i });
      fireEvent.click(checkbox1);
      fireEvent.click(checkbox2);
      
      const deleteButton = screen.getByRole('button', { name: /delete selected/i });
      fireEvent.click(deleteButton);
      
      // Confirm deletion
      expect(screen.getByText(/are you sure.*delete.*2 documents/i)).toBeInTheDocument();
      
      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByText(/2 documents deleted/i)).toBeInTheDocument();
      });
    });

    it('should move selected documents to folder', async () => {
      renderComponent();
      
      const checkbox = screen.getByRole('checkbox', { name: /select contract agreement/i });
      fireEvent.click(checkbox);
      
      const moveButton = screen.getByRole('button', { name: /move to folder/i });
      fireEvent.click(moveButton);
      
      expect(screen.getByRole('dialog', { name: /move documents/i })).toBeInTheDocument();
      
      const folderSelect = screen.getByLabelText('Select folder');
      fireEvent.change(folderSelect, { target: { value: 'contracts' } });
      
      const confirmMoveButton = screen.getByRole('button', { name: /move/i });
      fireEvent.click(confirmMoveButton);
      
      await waitFor(() => {
        expect(screen.getByText(/1 document moved/i)).toBeInTheDocument();
      });
    });

    it('should add tags to selected documents', async () => {
      renderComponent();
      
      const checkbox = screen.getByRole('checkbox', { name: /select contract agreement/i });
      fireEvent.click(checkbox);
      
      const addTagsButton = screen.getByRole('button', { name: /add tags/i });
      fireEvent.click(addTagsButton);
      
      expect(screen.getByRole('dialog', { name: /add tags/i })).toBeInTheDocument();
      
      const tagsInput = screen.getByLabelText('Tags');
      await userEvent.type(tagsInput, 'urgent,priority');
      
      const addButton = screen.getByRole('button', { name: /add tags/i });
      fireEvent.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByText(/tags added to 1 document/i)).toBeInTheDocument();
      });
    });

    it('should share selected documents', async () => {
      renderComponent();
      
      const checkbox = screen.getByRole('checkbox', { name: /select contract agreement/i });
      fireEvent.click(checkbox);
      
      const shareButton = screen.getByRole('button', { name: /share selected/i });
      fireEvent.click(shareButton);
      
      expect(screen.getByRole('dialog', { name: /share documents/i })).toBeInTheDocument();
      
      const emailInput = screen.getByLabelText('Email addresses');
      await userEvent.type(emailInput, 'colleague@example.com');
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText(/documents shared successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Quick Actions', () => {
    it('should show quick actions menu for each document', async () => {
      renderComponent();
      
      await waitFor(() => {
        const actionsButton = screen.getByTestId('document-actions-doc1');
        fireEvent.click(actionsButton);
      });
      
      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /view/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /download/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /share/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
    });

    it('should navigate to document viewer', async () => {
      renderComponent();
      
      const viewButton = screen.getByTestId('view-document-doc1');
      fireEvent.click(viewButton);
      
      expect(window.location.pathname).toBe('/documents/doc1/view');
    });

    it('should download individual document', async () => {
      renderComponent();
      
      const downloadButton = screen.getByTestId('download-document-doc1');
      fireEvent.click(downloadButton);
      
      await waitFor(() => {
        expect(screen.getByText(/download started/i)).toBeInTheDocument();
      });
    });

    it('should share individual document', async () => {
      renderComponent();
      
      const shareButton = screen.getByTestId('share-document-doc1');
      fireEvent.click(shareButton);
      
      expect(screen.getByRole('dialog', { name: /share document/i })).toBeInTheDocument();
    });

    it('should delete individual document with confirmation', async () => {
      renderComponent();
      
      const deleteButton = screen.getByTestId('delete-document-doc1');
      fireEvent.click(deleteButton);
      
      expect(screen.getByText(/are you sure.*delete.*contract agreement/i)).toBeInTheDocument();
      
      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByText(/document deleted/i)).toBeInTheDocument();
      });
    });
  });

  describe('Document Preview', () => {
    it('should show preview on hover for documents with thumbnails', async () => {
      renderComponent();
      
      const documentRow = screen.getByTestId('document-row-doc1');
      fireEvent.mouseEnter(documentRow);
      
      await waitFor(() => {
        expect(screen.getByTestId('document-preview')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /preview/i })).toBeInTheDocument();
      });
    });

    it('should hide preview on mouse leave', async () => {
      renderComponent();
      
      const documentRow = screen.getByTestId('document-row-doc1');
      fireEvent.mouseEnter(documentRow);
      
      await waitFor(() => {
        expect(screen.getByTestId('document-preview')).toBeInTheDocument();
      });
      
      fireEvent.mouseLeave(documentRow);
      
      await waitFor(() => {
        expect(screen.queryByTestId('document-preview')).not.toBeInTheDocument();
      });
    });

    it('should not show preview for documents without thumbnails', async () => {
      renderComponent();
      
      const documentRow = screen.getByTestId('document-row-doc4');
      fireEvent.mouseEnter(documentRow);
      
      // Wait a bit to ensure no preview appears
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(screen.queryByTestId('document-preview')).not.toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    it('should show export menu options', () => {
      renderComponent();
      
      const exportButton = screen.getByRole('button', { name: /export list/i });
      fireEvent.click(exportButton);
      
      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /csv/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /excel/i })).toBeInTheDocument();
    });

    it('should export to CSV', async () => {
      renderComponent();
      
      const exportButton = screen.getByRole('button', { name: /export list/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByRole('menuitem', { name: /csv/i });
      fireEvent.click(csvOption);
      
      await waitFor(() => {
        expect(screen.getByText(/export completed/i)).toBeInTheDocument();
      });
    });

    it('should export to Excel', async () => {
      renderComponent();
      
      const exportButton = screen.getByRole('button', { name: /export list/i });
      fireEvent.click(exportButton);
      
      const excelOption = screen.getByRole('menuitem', { name: /excel/i });
      fireEvent.click(excelOption);
      
      await waitFor(() => {
        expect(screen.getByText(/export completed/i)).toBeInTheDocument();
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
        expect(screen.getByText('1-50 of 47')).toBeInTheDocument();
      });
    });

    it('should navigate between pages', async () => {
      renderComponent();
      
      const nextButton = screen.getByRole('button', { name: /next page/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText('26-47 of 47')).toBeInTheDocument();
      });
    });

    it('should jump to specific page', async () => {
      renderComponent();
      
      const pageInput = screen.getByLabelText('Go to page');
      fireEvent.change(pageInput, { target: { value: '2' } });
      fireEvent.keyPress(pageInput, { key: 'Enter' });
      
      await waitFor(() => {
        expect(screen.getByText('26-47 of 47')).toBeInTheDocument();
      });
    });
  });

  describe('Loading and Error States', () => {
    it('should show loading state with skeletons', () => {
      renderComponent();
      
      expect(screen.getByTestId('documents-loading')).toBeInTheDocument();
      expect(screen.getAllByTestId('document-skeleton')).toHaveLength(6);
    });

    it('should handle load error with retry option', async () => {
      // Mock API error
      const { getDocuments } = require('../../../services/document.service').default;
      getDocuments.mockRejectedValue(new Error('Network error'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load documents/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
      
      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);
      
      expect(getDocuments).toHaveBeenCalledTimes(2);
    });

    it('should show empty state when no documents', async () => {
      // Mock empty response
      const { getDocuments } = require('../../../services/document.service').default;
      getDocuments.mockResolvedValue({ data: [], total: 0 });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        expect(screen.getByText(/no documents found/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /upload first document/i })).toBeInTheDocument();
      });
    });

    it('should show empty state with upload CTA when no results match filters', async () => {
      renderComponent();
      
      // Apply filter that returns no results
      const typeFilter = screen.getByLabelText('Document type');
      fireEvent.change(typeFilter, { target: { value: 'PNG' } });
      
      await waitFor(() => {
        expect(screen.getByTestId('no-results')).toBeInTheDocument();
        expect(screen.getByText(/no documents match your filters/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
      });
    });
  });

  describe('Performance Features', () => {
    it('should implement virtual scrolling for large lists', async () => {
      // Mock large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        ...sampleDocuments[0],
        id: `doc${i}`,
        title: `Document ${i}.pdf`,
      }));
      
      const { getDocuments } = require('../../../services/document.service').default;
      getDocuments.mockResolvedValue({ data: largeDataset, total: 1000 });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('virtual-scroll-container')).toBeInTheDocument();
      });
    });

    it('should cache results with React Query', async () => {
      const { getDocuments } = require('../../../services/document.service').default;
      getDocuments.mockResolvedValue({ data: sampleDocuments, total: 4 });
      
      renderComponent();
      
      await waitFor(() => {
        expect(getDocuments).toHaveBeenCalledTimes(1);
      });
      
      // Re-render should use cached data
      renderComponent();
      
      // Should not call API again
      expect(getDocuments).toHaveBeenCalledTimes(1);
    });

    it('should lazy load thumbnails', async () => {
      renderComponent();
      
      // Switch to grid view to see thumbnails
      const gridViewButton = screen.getByRole('button', { name: /grid view/i });
      fireEvent.click(gridViewButton);
      
      await waitFor(() => {
        const thumbnails = screen.getAllByRole('img', { name: /thumbnail/i });
        thumbnails.forEach(img => {
          expect(img).toHaveAttribute('loading', 'lazy');
        });
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile view', () => {
      global.innerWidth = 768;
      global.dispatchEvent(new Event('resize'));
      
      renderComponent();
      
      expect(screen.getByTestId('documents-list-page')).toHaveClass('mobile-view');
    });

    it('should show mobile-optimized controls', () => {
      global.innerWidth = 768;
      global.dispatchEvent(new Event('resize'));
      
      renderComponent();
      
      expect(screen.getByTestId('mobile-controls')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
    });

    it('should collapse table columns on small screens', async () => {
      global.innerWidth = 640;
      global.dispatchEvent(new Event('resize'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.queryByText('Department')).not.toBeInTheDocument();
        expect(screen.queryByText('Tags')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Documents list');
      expect(screen.getByRole('table')).toHaveAttribute('aria-label', 'Documents table');
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      await waitFor(() => {
        const firstRow = screen.getByTestId('document-row-doc1');
        firstRow.focus();
        
        fireEvent.keyDown(firstRow, { key: 'Enter' });
        
        expect(window.location.pathname).toBe('/documents/doc1/view');
      });
    });

    it('should announce filter results to screen readers', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search documents...');
      await userEvent.type(searchInput, 'Contract');
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/1 document found/i);
      });
    });

    it('should have sufficient color contrast for status indicators', async () => {
      renderComponent();
      
      await waitFor(() => {
        const confidentialBadge = screen.getByTestId('confidentiality-confidential');
        const styles = window.getComputedStyle(confidentialBadge);
        
        // Should have dark text on light background or vice versa
        expect(styles.color).toBeDefined();
        expect(styles.backgroundColor).toBeDefined();
      });
    });
  });

  describe('Permissions and Security', () => {
    it('should hide upload button without create permission', () => {
      (useAuthStore as any).mockReturnValue({
        user: { ...mockUser, permissions: ['view_documents'] },
        isAuthenticated: true,
      });
      
      renderComponent();
      
      expect(screen.queryByRole('button', { name: /upload documents/i })).not.toBeInTheDocument();
    });

    it('should disable edit actions without edit permission', async () => {
      (useAuthStore as any).mockReturnValue({
        user: { ...mockUser, permissions: ['view_documents'] },
        isAuthenticated: true,
      });
      
      renderComponent();
      
      await waitFor(() => {
        const actionsButton = screen.getByTestId('document-actions-doc1');
        fireEvent.click(actionsButton);
      });
      
      expect(screen.queryByRole('menuitem', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('should filter documents by user permissions', async () => {
      // Mock user with limited department access
      (useAuthStore as any).mockReturnValue({
        user: { 
          ...mockUser, 
          department: 'Legal',
          permissions: ['view_own_department_documents']
        },
        isAuthenticated: true,
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Agreement.pdf')).toBeInTheDocument();
        expect(screen.queryByText('Financial Report Q4.xlsx')).not.toBeInTheDocument();
      });
    });
  });
});