import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ComparisonView } from '../ComparisonView';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface Document {
  id: string;
  name: string;
  version: string;
  content: string;
  metadata: {
    createdAt: string;
    modifiedAt: string;
    author: string;
    size: number;
    pages: number;
  };
  sections?: Section[];
}

interface Section {
  id: string;
  title: string;
  content: string;
  type: 'clause' | 'paragraph' | 'heading';
  position: number;
}

interface Difference {
  id: string;
  type: 'addition' | 'deletion' | 'modification';
  leftContent?: string;
  rightContent?: string;
  leftLine?: number;
  rightLine?: number;
  section?: string;
  significance: 'low' | 'medium' | 'high' | 'critical';
}

// Mock API
vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('ComparisonView', () => {
  let queryClient: QueryClient;
  const mockOnAcceptChange = vi.fn();
  const mockOnRejectChange = vi.fn();
  const mockOnExport = vi.fn();
  const mockOnMerge = vi.fn();

  const leftDocument: Document = {
    id: '1',
    name: 'Contract v1.0',
    version: '1.0',
    content: 'This is the original contract content.\nSection 1: Terms\nSection 2: Conditions',
    metadata: {
      createdAt: '2024-01-01T10:00:00Z',
      modifiedAt: '2024-01-01T10:00:00Z',
      author: 'John Doe',
      size: 1024,
      pages: 5,
    },
    sections: [
      { id: 's1', title: 'Terms', content: 'Original terms', type: 'clause', position: 1 },
      { id: 's2', title: 'Conditions', content: 'Original conditions', type: 'clause', position: 2 },
    ],
  };

  const rightDocument: Document = {
    id: '2',
    name: 'Contract v2.0',
    version: '2.0',
    content: 'This is the modified contract content.\nSection 1: Updated Terms\nSection 2: Conditions\nSection 3: New Clause',
    metadata: {
      createdAt: '2024-01-15T10:00:00Z',
      modifiedAt: '2024-01-15T10:00:00Z',
      author: 'Jane Smith',
      size: 1536,
      pages: 6,
    },
    sections: [
      { id: 's1', title: 'Updated Terms', content: 'Modified terms', type: 'clause', position: 1 },
      { id: 's2', title: 'Conditions', content: 'Original conditions', type: 'clause', position: 2 },
      { id: 's3', title: 'New Clause', content: 'Additional clause', type: 'clause', position: 3 },
    ],
  };

  const differences: Difference[] = [
    {
      id: 'd1',
      type: 'modification',
      leftContent: 'original contract',
      rightContent: 'modified contract',
      leftLine: 1,
      rightLine: 1,
      section: 'Introduction',
      significance: 'medium',
    },
    {
      id: 'd2',
      type: 'modification',
      leftContent: 'Terms',
      rightContent: 'Updated Terms',
      leftLine: 2,
      rightLine: 2,
      section: 'Section 1',
      significance: 'high',
    },
    {
      id: 'd3',
      type: 'addition',
      rightContent: 'Section 3: New Clause',
      rightLine: 4,
      section: 'Section 3',
      significance: 'high',
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
      leftDocument,
      rightDocument,
      onAcceptChange: mockOnAcceptChange,
      onRejectChange: mockOnRejectChange,
      ...props,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <ComparisonView {...defaultProps} />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render both documents side by side', () => {
      renderComponent();
      
      expect(screen.getByText('Contract v1.0')).toBeInTheDocument();
      expect(screen.getByText('Contract v2.0')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /left document/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /right document/i })).toBeInTheDocument();
    });

    it('should display document metadata', () => {
      renderComponent();
      
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
      expect(screen.getByText(/5 pages/)).toBeInTheDocument();
      expect(screen.getByText(/6 pages/)).toBeInTheDocument();
    });

    it('should show version information', () => {
      renderComponent();
      
      expect(screen.getByText(/version 1\.0/i)).toBeInTheDocument();
      expect(screen.getByText(/version 2\.0/i)).toBeInTheDocument();
    });

    it('should render comparison toolbar', () => {
      renderComponent();
      
      expect(screen.getByRole('toolbar', { name: /comparison controls/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous difference/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next difference/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /toggle sync scroll/i })).toBeInTheDocument();
    });

    it('should show loading state when differences are being calculated', () => {
      renderComponent({ differences: null, isCalculating: true });
      
      expect(screen.getByText(/calculating differences/i)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Difference Highlighting', () => {
    it('should highlight differences in both documents', () => {
      renderComponent({ differences });
      
      const additions = document.querySelectorAll('.diff-addition');
      const deletions = document.querySelectorAll('.diff-deletion');
      const modifications = document.querySelectorAll('.diff-modification');
      
      expect(additions.length).toBeGreaterThan(0);
      expect(modifications.length).toBeGreaterThan(0);
    });

    it('should display difference count', () => {
      renderComponent({ differences });
      
      expect(screen.getByText(/3 differences found/i)).toBeInTheDocument();
      expect(screen.getByText(/1 addition/i)).toBeInTheDocument();
      expect(screen.getByText(/2 modifications/i)).toBeInTheDocument();
    });

    it('should color-code differences by type', () => {
      renderComponent({ differences });
      
      const additionMarker = screen.getByTestId('diff-marker-d3');
      const modificationMarker = screen.getByTestId('diff-marker-d1');
      
      expect(additionMarker).toHaveClass('bg-green-500');
      expect(modificationMarker).toHaveClass('bg-yellow-500');
    });

    it('should show significance indicators', () => {
      renderComponent({ differences });
      
      expect(screen.getByText(/high significance/i)).toBeInTheDocument();
      expect(screen.getByText(/medium significance/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate to next difference', async () => {
      renderComponent({ differences });
      
      const nextButton = screen.getByRole('button', { name: /next difference/i });
      await userEvent.click(nextButton);
      
      expect(screen.getByText(/difference 2 of 3/i)).toBeInTheDocument();
    });

    it('should navigate to previous difference', async () => {
      renderComponent({ differences, initialDifference: 2 });
      
      const prevButton = screen.getByRole('button', { name: /previous difference/i });
      await userEvent.click(prevButton);
      
      expect(screen.getByText(/difference 1 of 3/i)).toBeInTheDocument();
    });

    it('should scroll to difference when navigating', async () => {
      const scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;
      
      renderComponent({ differences });
      
      const nextButton = screen.getByRole('button', { name: /next difference/i });
      await userEvent.click(nextButton);
      
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });

    it('should disable previous button on first difference', () => {
      renderComponent({ differences });
      
      const prevButton = screen.getByRole('button', { name: /previous difference/i });
      expect(prevButton).toBeDisabled();
    });

    it('should disable next button on last difference', async () => {
      renderComponent({ differences, initialDifference: 3 });
      
      const nextButton = screen.getByRole('button', { name: /next difference/i });
      expect(nextButton).toBeDisabled();
    });

    it('should jump to specific difference from list', async () => {
      renderComponent({ differences });
      
      const diffItem = screen.getByRole('button', { name: /jump to difference 3/i });
      await userEvent.click(diffItem);
      
      expect(screen.getByText(/difference 3 of 3/i)).toBeInTheDocument();
    });
  });

  describe('Synchronized Scrolling', () => {
    it('should sync scroll by default', () => {
      renderComponent();
      
      const syncButton = screen.getByRole('button', { name: /toggle sync scroll/i });
      expect(syncButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should toggle synchronized scrolling', async () => {
      renderComponent();
      
      const syncButton = screen.getByRole('button', { name: /toggle sync scroll/i });
      await userEvent.click(syncButton);
      
      expect(syncButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('should sync scroll positions when enabled', async () => {
      renderComponent();
      
      const leftPane = screen.getByTestId('left-document-pane');
      const rightPane = screen.getByTestId('right-document-pane');
      
      // Simulate scroll on left pane
      fireEvent.scroll(leftPane, { target: { scrollTop: 100 } });
      
      await waitFor(() => {
        expect(rightPane.scrollTop).toBe(100);
      });
    });

    it('should not sync scroll when disabled', async () => {
      renderComponent({ syncScroll: false });
      
      const leftPane = screen.getByTestId('left-document-pane');
      const rightPane = screen.getByTestId('right-document-pane');
      
      fireEvent.scroll(leftPane, { target: { scrollTop: 100 } });
      
      await waitFor(() => {
        expect(rightPane.scrollTop).toBe(0);
      });
    });
  });

  describe('View Modes', () => {
    it('should switch to unified view', async () => {
      renderComponent({ differences });
      
      const viewModeSelect = screen.getByRole('combobox', { name: /view mode/i });
      await userEvent.selectOptions(viewModeSelect, 'unified');
      
      expect(screen.getByRole('region', { name: /unified comparison/i })).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: /left document/i })).not.toBeInTheDocument();
    });

    it('should switch to inline view', async () => {
      renderComponent({ differences });
      
      const viewModeSelect = screen.getByRole('combobox', { name: /view mode/i });
      await userEvent.selectOptions(viewModeSelect, 'inline');
      
      expect(screen.getByRole('region', { name: /inline comparison/i })).toBeInTheDocument();
    });

    it('should maintain difference highlighting in different views', async () => {
      renderComponent({ differences });
      
      const viewModeSelect = screen.getByRole('combobox', { name: /view mode/i });
      await userEvent.selectOptions(viewModeSelect, 'unified');
      
      const modifications = document.querySelectorAll('.diff-modification');
      expect(modifications.length).toBeGreaterThan(0);
    });
  });

  describe('Filtering', () => {
    it('should filter differences by type', async () => {
      renderComponent({ differences });
      
      const filterSelect = screen.getByRole('combobox', { name: /filter by type/i });
      await userEvent.selectOptions(filterSelect, 'additions');
      
      expect(screen.getByText(/1 difference shown/i)).toBeInTheDocument();
      expect(screen.queryByText(/Terms.*Updated Terms/)).not.toBeInTheDocument();
    });

    it('should filter by significance level', async () => {
      renderComponent({ differences });
      
      const significanceFilter = screen.getByRole('combobox', { name: /filter by significance/i });
      await userEvent.selectOptions(significanceFilter, 'high');
      
      expect(screen.getByText(/2 differences shown/i)).toBeInTheDocument();
    });

    it('should filter by section', async () => {
      renderComponent({ differences });
      
      const sectionFilter = screen.getByRole('combobox', { name: /filter by section/i });
      await userEvent.selectOptions(sectionFilter, 'Section 1');
      
      expect(screen.getByText(/1 difference shown/i)).toBeInTheDocument();
    });

    it('should combine multiple filters', async () => {
      renderComponent({ differences });
      
      const typeFilter = screen.getByRole('combobox', { name: /filter by type/i });
      const significanceFilter = screen.getByRole('combobox', { name: /filter by significance/i });
      
      await userEvent.selectOptions(typeFilter, 'modification');
      await userEvent.selectOptions(significanceFilter, 'high');
      
      expect(screen.getByText(/1 difference shown/i)).toBeInTheDocument();
    });

    it('should clear all filters', async () => {
      renderComponent({ differences });
      
      const typeFilter = screen.getByRole('combobox', { name: /filter by type/i });
      await userEvent.selectOptions(typeFilter, 'additions');
      
      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      await userEvent.click(clearButton);
      
      expect(screen.getByText(/3 differences found/i)).toBeInTheDocument();
    });
  });

  describe('Change Actions', () => {
    it('should accept individual changes', async () => {
      renderComponent({ differences });
      
      const acceptButton = screen.getAllByRole('button', { name: /accept change/i })[0];
      await userEvent.click(acceptButton);
      
      expect(mockOnAcceptChange).toHaveBeenCalledWith('d1');
    });

    it('should reject individual changes', async () => {
      renderComponent({ differences });
      
      const rejectButton = screen.getAllByRole('button', { name: /reject change/i })[0];
      await userEvent.click(rejectButton);
      
      expect(mockOnRejectChange).toHaveBeenCalledWith('d1');
    });

    it('should accept all changes', async () => {
      renderComponent({ differences });
      
      const acceptAllButton = screen.getByRole('button', { name: /accept all/i });
      await userEvent.click(acceptAllButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm accept all/i });
      await userEvent.click(confirmButton);
      
      expect(mockOnAcceptChange).toHaveBeenCalledWith(['d1', 'd2', 'd3']);
    });

    it('should reject all changes', async () => {
      renderComponent({ differences });
      
      const rejectAllButton = screen.getByRole('button', { name: /reject all/i });
      await userEvent.click(rejectAllButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm reject all/i });
      await userEvent.click(confirmButton);
      
      expect(mockOnRejectChange).toHaveBeenCalledWith(['d1', 'd2', 'd3']);
    });

    it('should show confirmation dialog for bulk actions', async () => {
      renderComponent({ differences });
      
      const acceptAllButton = screen.getByRole('button', { name: /accept all/i });
      await userEvent.click(acceptAllButton);
      
      expect(screen.getByText(/are you sure.*accept all/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('Export', () => {
    it('should export comparison report', async () => {
      renderComponent({ differences, onExport: mockOnExport });
      
      const exportButton = screen.getByRole('button', { name: /export comparison/i });
      await userEvent.click(exportButton);
      
      const pdfOption = screen.getByRole('menuitem', { name: /export as pdf/i });
      await userEvent.click(pdfOption);
      
      expect(mockOnExport).toHaveBeenCalledWith('pdf', expect.objectContaining({
        leftDocument,
        rightDocument,
        differences,
      }));
    });

    it('should export in multiple formats', async () => {
      renderComponent({ differences, onExport: mockOnExport });
      
      const exportButton = screen.getByRole('button', { name: /export comparison/i });
      await userEvent.click(exportButton);
      
      expect(screen.getByRole('menuitem', { name: /export as pdf/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /export as word/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /export as html/i })).toBeInTheDocument();
    });
  });

  describe('Merge Functionality', () => {
    it('should enable merge mode', async () => {
      renderComponent({ differences, onMerge: mockOnMerge });
      
      const mergeButton = screen.getByRole('button', { name: /create merged version/i });
      await userEvent.click(mergeButton);
      
      expect(screen.getByText(/merge mode active/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /finish merge/i })).toBeInTheDocument();
    });

    it('should select changes for merge', async () => {
      renderComponent({ differences, onMerge: mockOnMerge });
      
      const mergeButton = screen.getByRole('button', { name: /create merged version/i });
      await userEvent.click(mergeButton);
      
      const selectCheckbox = screen.getAllByRole('checkbox', { name: /include in merge/i })[0];
      await userEvent.click(selectCheckbox);
      
      expect(selectCheckbox).toBeChecked();
      expect(screen.getByText(/1 change selected/i)).toBeInTheDocument();
    });

    it('should complete merge with selected changes', async () => {
      renderComponent({ differences, onMerge: mockOnMerge });
      
      const mergeButton = screen.getByRole('button', { name: /create merged version/i });
      await userEvent.click(mergeButton);
      
      const selectCheckbox = screen.getAllByRole('checkbox', { name: /include in merge/i })[0];
      await userEvent.click(selectCheckbox);
      
      const finishButton = screen.getByRole('button', { name: /finish merge/i });
      await userEvent.click(finishButton);
      
      expect(mockOnMerge).toHaveBeenCalledWith(['d1']);
    });
  });

  describe('Search', () => {
    it('should search within comparison', async () => {
      renderComponent({ differences });
      
      const searchInput = screen.getByRole('searchbox', { name: /search in comparison/i });
      await userEvent.type(searchInput, 'Terms');
      
      expect(screen.getByText(/2 matches found/i)).toBeInTheDocument();
    });

    it('should highlight search results', async () => {
      renderComponent({ differences });
      
      const searchInput = screen.getByRole('searchbox', { name: /search in comparison/i });
      await userEvent.type(searchInput, 'contract');
      
      const highlights = document.querySelectorAll('.search-highlight');
      expect(highlights.length).toBeGreaterThan(0);
    });

    it('should navigate through search results', async () => {
      renderComponent({ differences });
      
      const searchInput = screen.getByRole('searchbox', { name: /search in comparison/i });
      await userEvent.type(searchInput, 'Section');
      
      const nextMatchButton = screen.getByRole('button', { name: /next match/i });
      await userEvent.click(nextMatchButton);
      
      expect(screen.getByText(/match 2 of/i)).toBeInTheDocument();
    });
  });

  describe('Comments', () => {
    it('should add comments to differences', async () => {
      renderComponent({ differences, enableComments: true });
      
      const commentButton = screen.getAllByRole('button', { name: /add comment/i })[0];
      await userEvent.click(commentButton);
      
      const commentInput = screen.getByRole('textbox', { name: /comment text/i });
      await userEvent.type(commentInput, 'This change needs review');
      
      const saveButton = screen.getByRole('button', { name: /save comment/i });
      await userEvent.click(saveButton);
      
      expect(screen.getByText('This change needs review')).toBeInTheDocument();
    });

    it('should display existing comments', () => {
      const differencesWithComments = [
        {
          ...differences[0],
          comments: [
            { id: 'c1', text: 'Important change', author: 'John Doe', timestamp: '2024-01-15T10:00:00Z' },
          ],
        },
      ];
      
      renderComponent({ differences: differencesWithComments, enableComments: true });
      
      expect(screen.getByText('Important change')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent({ differences });
      
      expect(screen.getByRole('region', { name: /comparison view/i })).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: /difference navigation/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderComponent({ differences });
      
      // Navigate with keyboard
      fireEvent.keyDown(document, { key: 'n', altKey: true });
      expect(screen.getByText(/difference 2 of 3/i)).toBeInTheDocument();
      
      fireEvent.keyDown(document, { key: 'p', altKey: true });
      expect(screen.getByText(/difference 1 of 3/i)).toBeInTheDocument();
    });

    it('should announce changes to screen readers', () => {
      renderComponent({ differences });
      
      const liveRegion = screen.getByRole('status', { live: 'polite' });
      expect(liveRegion).toBeInTheDocument();
    });

    it('should have focus management', async () => {
      renderComponent({ differences });
      
      const nextButton = screen.getByRole('button', { name: /next difference/i });
      await userEvent.click(nextButton);
      
      const activeDifference = document.querySelector('[data-difference-active="true"]');
      expect(activeDifference).toHaveFocus();
    });
  });

  describe('Performance', () => {
    it('should handle large documents efficiently', () => {
      const largeLeftDoc = { ...leftDocument, content: 'x'.repeat(100000) };
      const largeRightDoc = { ...rightDocument, content: 'y'.repeat(100000) };
      
      renderComponent({ leftDocument: largeLeftDoc, rightDocument: largeRightDoc });
      
      expect(screen.getByText('Contract v1.0')).toBeInTheDocument();
      expect(screen.getByText('Contract v2.0')).toBeInTheDocument();
    });

    it('should virtualize long difference lists', () => {
      const manyDifferences = Array.from({ length: 1000 }, (_, i) => ({
        id: `d${i}`,
        type: 'modification' as const,
        leftContent: `Line ${i}`,
        rightContent: `Modified line ${i}`,
        leftLine: i,
        rightLine: i,
        significance: 'low' as const,
      }));
      
      renderComponent({ differences: manyDifferences });
      
      // Should only render visible differences
      const renderedDiffs = document.querySelectorAll('[data-difference-id]');
      expect(renderedDiffs.length).toBeLessThan(100);
    });
  });
});