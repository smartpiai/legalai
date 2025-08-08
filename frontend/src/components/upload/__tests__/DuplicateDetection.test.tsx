import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { DuplicateDetection } from '../DuplicateDetection';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../../services/api';

// Mock API
vi.mock('../../../services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

interface DuplicateFile {
  id: number;
  name: string;
  uploadedAt: string;
  uploadedBy: string;
  size: number;
  checksum: string;
  matchScore: number;
  matchType: 'exact' | 'similar' | 'name';
}

describe('DuplicateDetection', () => {
  let queryClient: QueryClient;
  const mockOnResolve = vi.fn();
  const mockOnIgnore = vi.fn();
  const mockOnReplace = vi.fn();
  
  const testFile = new File(['test content'], 'test-document.pdf', {
    type: 'application/pdf',
  });
  
  const mockDuplicates: DuplicateFile[] = [
    {
      id: 1,
      name: 'test-document.pdf',
      uploadedAt: '2024-01-15T10:30:00Z',
      uploadedBy: 'John Doe',
      size: 1024000,
      checksum: 'abc123',
      matchScore: 1.0,
      matchType: 'exact',
    },
    {
      id: 2,
      name: 'test-document-v2.pdf',
      uploadedAt: '2024-01-10T14:20:00Z',
      uploadedBy: 'Jane Smith',
      size: 1024500,
      checksum: 'def456',
      matchScore: 0.85,
      matchType: 'similar',
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
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      file: testFile,
      onResolve: mockOnResolve,
      onIgnore: mockOnIgnore,
      onReplace: mockOnReplace,
      ...props,
    };
    
    return render(
      <QueryClientProvider client={queryClient}>
        <DuplicateDetection {...defaultProps} />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render loading state initially', () => {
      renderComponent();
      expect(screen.getByText(/checking for duplicates/i)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should render no duplicates message when none found', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: [] } });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/no duplicates found/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /proceed with upload/i })).toBeInTheDocument();
      });
    });

    it('should render duplicate list when duplicates found', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/2 potential duplicates found/i)).toBeInTheDocument();
        expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
        expect(screen.getByText('test-document-v2.pdf')).toBeInTheDocument();
      });
    });

    it('should display match type badges', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/exact match/i)).toBeInTheDocument();
        expect(screen.getByText(/85% similar/i)).toBeInTheDocument();
      });
    });

    it('should format file sizes correctly', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/1.00 MB/)).toBeInTheDocument();
        expect(screen.getByText(/1.00 MB/)).toBeInTheDocument();
      });
    });

    it('should display upload information', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
        expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
        expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
        expect(screen.getByText(/Jan 10, 2024/)).toBeInTheDocument();
      });
    });
  });

  describe('Duplicate Detection', () => {
    it('should call API with file checksum', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/v1/documents/check-duplicates', {
          checksum: expect.any(String),
          filename: 'test-document.pdf',
          size: testFile.size,
        });
      });
    });

    it('should calculate file checksum before checking', async () => {
      const mockCalculateChecksum = vi.fn().mockResolvedValue('calculated-checksum');
      
      renderComponent({ calculateChecksum: mockCalculateChecksum });
      
      await waitFor(() => {
        expect(mockCalculateChecksum).toHaveBeenCalledWith(testFile);
      });
    });

    it('should handle API errors gracefully', async () => {
      (api.post as any).mockRejectedValue(new Error('API Error'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/error checking for duplicates/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should retry on API error', async () => {
      (api.post as any)
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({ data: { duplicates: [] } });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/error checking for duplicates/i)).toBeInTheDocument();
      });
      
      const retryBtn = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryBtn);
      
      await waitFor(() => {
        expect(screen.getByText(/no duplicates found/i)).toBeInTheDocument();
        expect(api.post).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('User Actions', () => {
    it('should call onIgnore when proceed button is clicked', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: [] } });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /proceed with upload/i })).toBeInTheDocument();
      });
      
      const proceedBtn = screen.getByRole('button', { name: /proceed with upload/i });
      await userEvent.click(proceedBtn);
      
      expect(mockOnIgnore).toHaveBeenCalled();
    });

    it('should show replace dialog when replace button clicked', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent();
      
      await waitFor(() => {
        const replaceButtons = screen.getAllByRole('button', { name: /replace/i });
        expect(replaceButtons).toHaveLength(2);
      });
      
      const replaceBtn = screen.getAllByRole('button', { name: /replace/i })[0];
      await userEvent.click(replaceBtn);
      
      expect(screen.getByText(/confirm replacement/i)).toBeInTheDocument();
      expect(screen.getByText(/this will replace the existing file/i)).toBeInTheDocument();
    });

    it('should call onReplace with document id when confirmed', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /replace/i })).toHaveLength(2);
      });
      
      const replaceBtn = screen.getAllByRole('button', { name: /replace/i })[0];
      await userEvent.click(replaceBtn);
      
      const confirmBtn = screen.getByRole('button', { name: /confirm replace/i });
      await userEvent.click(confirmBtn);
      
      expect(mockOnReplace).toHaveBeenCalledWith(1);
    });

    it('should show view details when button clicked', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent();
      
      await waitFor(() => {
        const viewButtons = screen.getAllByRole('button', { name: /view details/i });
        expect(viewButtons).toHaveLength(2);
      });
      
      const viewBtn = screen.getAllByRole('button', { name: /view details/i })[0];
      await userEvent.click(viewBtn);
      
      expect(screen.getByText(/document details/i)).toBeInTheDocument();
      expect(screen.getByText(/checksum.*abc123/i)).toBeInTheDocument();
    });

    it('should allow ignoring duplicates and proceeding', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ignore and proceed/i })).toBeInTheDocument();
      });
      
      const ignoreBtn = screen.getByRole('button', { name: /ignore and proceed/i });
      await userEvent.click(ignoreBtn);
      
      expect(mockOnIgnore).toHaveBeenCalled();
    });

    it('should allow creating new version', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create new version/i })).toBeInTheDocument();
      });
      
      const versionBtn = screen.getByRole('button', { name: /create new version/i });
      await userEvent.click(versionBtn);
      
      expect(mockOnResolve).toHaveBeenCalledWith({ action: 'version', parentId: 1 });
    });
  });

  describe('Comparison View', () => {
    it('should show side-by-side comparison when requested', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent();
      
      await waitFor(() => {
        const compareButtons = screen.getAllByRole('button', { name: /compare/i });
        expect(compareButtons).toHaveLength(2);
      });
      
      const compareBtn = screen.getAllByRole('button', { name: /compare/i })[0];
      await userEvent.click(compareBtn);
      
      expect(screen.getByText(/file comparison/i)).toBeInTheDocument();
      expect(screen.getByText(/new file/i)).toBeInTheDocument();
      expect(screen.getByText(/existing file/i)).toBeInTheDocument();
    });

    it('should highlight differences in comparison', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent();
      
      await waitFor(() => {
        const compareButtons = screen.getAllByRole('button', { name: /compare/i });
        expect(compareButtons).toHaveLength(2);
      });
      
      const compareBtn = screen.getAllByRole('button', { name: /compare/i })[0];
      await userEvent.click(compareBtn);
      
      expect(screen.getByText(/differences/i)).toBeInTheDocument();
      expect(screen.getByText(/file size.*different/i)).toBeInTheDocument();
    });
  });

  describe('Filtering and Sorting', () => {
    it('should filter duplicates by match type', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/filter by match type/i)).toBeInTheDocument();
      });
      
      const filterSelect = screen.getByLabelText(/filter by match type/i);
      await userEvent.selectOptions(filterSelect, 'exact');
      
      expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      expect(screen.queryByText('test-document-v2.pdf')).not.toBeInTheDocument();
    });

    it('should sort duplicates by match score', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/sort by/i)).toBeInTheDocument();
      });
      
      const sortSelect = screen.getByLabelText(/sort by/i);
      await userEvent.selectOptions(sortSelect, 'score_desc');
      
      const items = screen.getAllByTestId('duplicate-item');
      expect(items[0]).toHaveTextContent('test-document.pdf');
      expect(items[1]).toHaveTextContent('test-document-v2.pdf');
    });

    it('should sort duplicates by date', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/sort by/i)).toBeInTheDocument();
      });
      
      const sortSelect = screen.getByLabelText(/sort by/i);
      await userEvent.selectOptions(sortSelect, 'date_desc');
      
      const items = screen.getAllByTestId('duplicate-item');
      expect(items[0]).toHaveTextContent('test-document.pdf');
      expect(items[1]).toHaveTextContent('test-document-v2.pdf');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('region', { name: /duplicate detection results/i })).toBeInTheDocument();
        expect(screen.getByRole('list', { name: /duplicate files/i })).toBeInTheDocument();
      });
    });

    it('should announce results to screen readers', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent();
      
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(/2 potential duplicates found/i);
      });
    });

    it('should support keyboard navigation', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent();
      
      await waitFor(() => {
        const firstItem = screen.getAllByTestId('duplicate-item')[0];
        expect(firstItem).toHaveAttribute('tabIndex', '0');
      });
      
      const items = screen.getAllByTestId('duplicate-item');
      items[0].focus();
      
      fireEvent.keyDown(items[0], { key: 'ArrowDown' });
      expect(document.activeElement).toBe(items[1]);
      
      fireEvent.keyDown(items[1], { key: 'ArrowUp' });
      expect(document.activeElement).toBe(items[0]);
    });
  });

  describe('Auto-resolution', () => {
    it('should auto-proceed when no duplicates and autoProceed is true', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: [] } });
      
      renderComponent({ autoProceed: true });
      
      await waitFor(() => {
        expect(mockOnIgnore).toHaveBeenCalled();
      });
    });

    it('should not auto-proceed when duplicates found', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent({ autoProceed: true });
      
      await waitFor(() => {
        expect(screen.getByText(/2 potential duplicates found/i)).toBeInTheDocument();
      });
      
      expect(mockOnIgnore).not.toHaveBeenCalled();
    });

    it('should apply threshold for similarity matching', async () => {
      const lowSimilarityDuplicate = {
        ...mockDuplicates[1],
        matchScore: 0.5,
      };
      
      (api.post as any).mockResolvedValue({ 
        data: { duplicates: [mockDuplicates[0], lowSimilarityDuplicate] } 
      });
      
      renderComponent({ similarityThreshold: 0.7 });
      
      await waitFor(() => {
        expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
        expect(screen.queryByText('test-document-v2.pdf')).not.toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should show progress for large file checksum calculation', async () => {
      const largeFile = new File(['x'.repeat(50 * 1024 * 1024)], 'large.pdf', {
        type: 'application/pdf',
      });
      
      let progressCallback: any;
      const mockCalculateChecksum = vi.fn().mockImplementation((file, onProgress) => {
        progressCallback = onProgress;
        return new Promise(resolve => {
          setTimeout(() => {
            onProgress(50);
            setTimeout(() => {
              onProgress(100);
              resolve('checksum');
            }, 100);
          }, 100);
        });
      });
      
      renderComponent({ 
        file: largeFile,
        calculateChecksum: mockCalculateChecksum 
      });
      
      await waitFor(() => {
        expect(screen.getByText(/calculating file signature/i)).toBeInTheDocument();
      });
      
      await waitFor(() => {
        expect(screen.getByText(/50%/)).toBeInTheDocument();
      });
      
      await waitFor(() => {
        expect(screen.getByText(/100%/)).toBeInTheDocument();
      });
    });

    it('should debounce filter changes', async () => {
      (api.post as any).mockResolvedValue({ data: { duplicates: mockDuplicates } });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/filter by match type/i)).toBeInTheDocument();
      });
      
      const filterSelect = screen.getByLabelText(/filter by match type/i);
      
      // Rapid changes
      await userEvent.selectOptions(filterSelect, 'exact');
      await userEvent.selectOptions(filterSelect, 'similar');
      await userEvent.selectOptions(filterSelect, 'all');
      
      // Should only render once after debounce
      await waitFor(() => {
        expect(screen.getAllByTestId('duplicate-item')).toHaveLength(2);
      });
    });
  });
});