import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ExtractionResultVisualization } from '../ExtractionResultVisualization';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface ExtractedField {
  id: string;
  name: string;
  type: 'text' | 'date' | 'number' | 'boolean' | 'list' | 'entity';
  value: any;
  confidence: number;
  source: {
    page: number;
    coordinates: { x: number; y: number; width: number; height: number };
    originalText: string;
  };
  suggestions?: string[];
  category: string;
  required: boolean;
}

interface ExtractionEntity {
  id: string;
  type: 'person' | 'organization' | 'location' | 'date' | 'money' | 'clause';
  text: string;
  confidence: number;
  source: {
    page: number;
    coordinates: { x: number; y: number; width: number; height: number };
  };
  metadata?: Record<string, any>;
}

interface ExtractionResult {
  id: string;
  documentId: string;
  documentName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'manual_review';
  extractedFields: ExtractedField[];
  entities: ExtractionEntity[];
  confidence: number;
  processingTime: number;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  errors?: string[];
  warnings?: string[];
}

// Mock API
vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe('ExtractionResultVisualization', () => {
  let queryClient: QueryClient;
  const mockOnFieldUpdate = vi.fn();
  const mockOnApprove = vi.fn();
  const mockOnReject = vi.fn();
  const mockOnExport = vi.fn();

  const extractedFields: ExtractedField[] = [
    {
      id: 'f1',
      name: 'Contract Title',
      type: 'text',
      value: 'Software License Agreement',
      confidence: 0.95,
      source: {
        page: 1,
        coordinates: { x: 100, y: 50, width: 300, height: 20 },
        originalText: 'Software License Agreement',
      },
      category: 'Basic Information',
      required: true,
    },
    {
      id: 'f2',
      name: 'Effective Date',
      type: 'date',
      value: '2024-01-15',
      confidence: 0.87,
      source: {
        page: 1,
        coordinates: { x: 100, y: 120, width: 120, height: 15 },
        originalText: 'January 15, 2024',
      },
      suggestions: ['2024-01-16', '2024-01-14'],
      category: 'Dates',
      required: true,
    },
    {
      id: 'f3',
      name: 'Contract Value',
      type: 'number',
      value: 50000,
      confidence: 0.78,
      source: {
        page: 2,
        coordinates: { x: 200, y: 300, width: 100, height: 15 },
        originalText: '$50,000',
      },
      category: 'Financial',
      required: false,
    },
  ];

  const entities: ExtractionEntity[] = [
    {
      id: 'e1',
      type: 'organization',
      text: 'Acme Corporation',
      confidence: 0.92,
      source: {
        page: 1,
        coordinates: { x: 150, y: 200, width: 150, height: 15 },
      },
      metadata: { role: 'client' },
    },
    {
      id: 'e2',
      type: 'person',
      text: 'John Smith',
      confidence: 0.88,
      source: {
        page: 1,
        coordinates: { x: 150, y: 250, width: 100, height: 15 },
      },
      metadata: { title: 'CEO' },
    },
    {
      id: 'e3',
      type: 'money',
      text: '$50,000',
      confidence: 0.96,
      source: {
        page: 2,
        coordinates: { x: 200, y: 300, width: 70, height: 15 },
      },
    },
  ];

  const extractionResult: ExtractionResult = {
    id: 'ext1',
    documentId: 'doc1',
    documentName: 'contract.pdf',
    status: 'completed',
    extractedFields,
    entities,
    confidence: 0.87,
    processingTime: 15.2,
    createdAt: '2024-01-15T10:00:00Z',
    warnings: ['Low confidence detected for Contract Value field'],
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
      extractionResult,
      onFieldUpdate: mockOnFieldUpdate,
      onApprove: mockOnApprove,
      onReject: mockOnReject,
      ...props,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <ExtractionResultVisualization {...defaultProps} />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render extraction result overview', () => {
      renderComponent();
      
      expect(screen.getByText('contract.pdf')).toBeInTheDocument();
      expect(screen.getByText(/overall confidence: 87%/i)).toBeInTheDocument();
      expect(screen.getByText(/processing time: 15\.2s/i)).toBeInTheDocument();
      expect(screen.getByText(/3 fields extracted/i)).toBeInTheDocument();
    });

    it('should display extraction status', () => {
      renderComponent();
      
      expect(screen.getByText(/completed/i)).toBeInTheDocument();
      expect(screen.getByTestId('status-indicator')).toHaveClass('bg-green-500');
    });

    it('should show warnings when present', () => {
      renderComponent();
      
      expect(screen.getByText(/1 warning/i)).toBeInTheDocument();
      expect(screen.getByText(/low confidence detected/i)).toBeInTheDocument();
    });

    it('should display errors when present', () => {
      const resultWithErrors = {
        ...extractionResult,
        status: 'failed' as const,
        errors: ['Failed to extract Contract Value', 'Document format not supported'],
      };
      
      renderComponent({ extractionResult: resultWithErrors });
      
      expect(screen.getByText(/2 errors/i)).toBeInTheDocument();
      expect(screen.getByText(/failed to extract contract value/i)).toBeInTheDocument();
    });

    it('should render loading state', () => {
      const processingResult = {
        ...extractionResult,
        status: 'processing' as const,
      };
      
      renderComponent({ extractionResult: processingResult });
      
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Extracted Fields Display', () => {
    it('should display all extracted fields', () => {
      renderComponent();
      
      expect(screen.getByText('Contract Title')).toBeInTheDocument();
      expect(screen.getByText('Software License Agreement')).toBeInTheDocument();
      expect(screen.getByText('Effective Date')).toBeInTheDocument();
      expect(screen.getByText('2024-01-15')).toBeInTheDocument();
      expect(screen.getByText('Contract Value')).toBeInTheDocument();
      expect(screen.getByText('50000')).toBeInTheDocument();
    });

    it('should group fields by category', () => {
      renderComponent();
      
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
      expect(screen.getByText('Dates')).toBeInTheDocument();
      expect(screen.getByText('Financial')).toBeInTheDocument();
    });

    it('should display confidence scores', () => {
      renderComponent();
      
      expect(screen.getByText(/95%/)).toBeInTheDocument();
      expect(screen.getByText(/87%/)).toBeInTheDocument();
      expect(screen.getByText(/78%/)).toBeInTheDocument();
    });

    it('should show confidence indicators with colors', () => {
      renderComponent();
      
      const highConfidence = screen.getByTestId('confidence-f1');
      const mediumConfidence = screen.getByTestId('confidence-f2');
      const lowConfidence = screen.getByTestId('confidence-f3');
      
      expect(highConfidence).toHaveClass('text-green-600');
      expect(mediumConfidence).toHaveClass('text-yellow-600');
      expect(lowConfidence).toHaveClass('text-red-600');
    });

    it('should indicate required fields', () => {
      renderComponent();
      
      const requiredField = screen.getByTestId('field-f1');
      const optionalField = screen.getByTestId('field-f3');
      
      expect(requiredField).toHaveTextContent('*');
      expect(optionalField).not.toHaveTextContent('*');
    });

    it('should show field suggestions when available', () => {
      renderComponent();
      
      const fieldWithSuggestions = screen.getByTestId('field-f2');
      expect(fieldWithSuggestions).toHaveTextContent('suggestions available');
      
      const suggestionsButton = screen.getByRole('button', { name: /view suggestions/i });
      expect(suggestionsButton).toBeInTheDocument();
    });

    it('should display field types', () => {
      renderComponent();
      
      expect(screen.getByText(/text/i)).toBeInTheDocument();
      expect(screen.getByText(/date/i)).toBeInTheDocument();
      expect(screen.getByText(/number/i)).toBeInTheDocument();
    });
  });

  describe('Field Editing', () => {
    it('should allow editing field values', async () => {
      renderComponent();
      
      const editButton = screen.getAllByRole('button', { name: /edit field/i })[0];
      await userEvent.click(editButton);
      
      const input = screen.getByDisplayValue('Software License Agreement');
      await userEvent.clear(input);
      await userEvent.type(input, 'Updated License Agreement');
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);
      
      expect(mockOnFieldUpdate).toHaveBeenCalledWith('f1', 'Updated License Agreement');
    });

    it('should validate field values based on type', async () => {
      renderComponent();
      
      const dateField = screen.getByTestId('field-f2');
      const editButton = dateField.querySelector('[aria-label="Edit field"]');
      await userEvent.click(editButton!);
      
      const input = screen.getByDisplayValue('2024-01-15');
      await userEvent.clear(input);
      await userEvent.type(input, 'invalid-date');
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);
      
      expect(screen.getByText(/invalid date format/i)).toBeInTheDocument();
      expect(mockOnFieldUpdate).not.toHaveBeenCalled();
    });

    it('should show field suggestions in dropdown', async () => {
      renderComponent();
      
      const suggestionsButton = screen.getByRole('button', { name: /view suggestions/i });
      await userEvent.click(suggestionsButton);
      
      expect(screen.getByText('2024-01-16')).toBeInTheDocument();
      expect(screen.getByText('2024-01-14')).toBeInTheDocument();
      
      const suggestionButton = screen.getByRole('button', { name: /use suggestion.*2024-01-16/i });
      await userEvent.click(suggestionButton);
      
      expect(mockOnFieldUpdate).toHaveBeenCalledWith('f2', '2024-01-16');
    });

    it('should cancel editing on escape key', async () => {
      renderComponent();
      
      const editButton = screen.getAllByRole('button', { name: /edit field/i })[0];
      await userEvent.click(editButton);
      
      const input = screen.getByDisplayValue('Software License Agreement');
      await userEvent.type(input, ' Updated');
      
      fireEvent.keyDown(input, { key: 'Escape' });
      
      expect(screen.getByText('Software License Agreement')).toBeInTheDocument();
      expect(mockOnFieldUpdate).not.toHaveBeenCalled();
    });

    it('should save on enter key', async () => {
      renderComponent();
      
      const editButton = screen.getAllByRole('button', { name: /edit field/i })[0];
      await userEvent.click(editButton);
      
      const input = screen.getByDisplayValue('Software License Agreement');
      await userEvent.clear(input);
      await userEvent.type(input, 'New Title');
      
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(mockOnFieldUpdate).toHaveBeenCalledWith('f1', 'New Title');
    });
  });

  describe('Entity Visualization', () => {
    it('should display extracted entities', () => {
      renderComponent();
      
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('$50,000')).toBeInTheDocument();
    });

    it('should group entities by type', () => {
      renderComponent();
      
      expect(screen.getByText('Organizations')).toBeInTheDocument();
      expect(screen.getByText('People')).toBeInTheDocument();
      expect(screen.getByText('Money')).toBeInTheDocument();
    });

    it('should display entity metadata', () => {
      renderComponent();
      
      expect(screen.getByText(/client/i)).toBeInTheDocument();
      expect(screen.getByText(/ceo/i)).toBeInTheDocument();
    });

    it('should show entity confidence scores', () => {
      renderComponent();
      
      const organizationEntity = screen.getByTestId('entity-e1');
      const personEntity = screen.getByTestId('entity-e2');
      
      expect(organizationEntity).toHaveTextContent('92%');
      expect(personEntity).toHaveTextContent('88%');
    });
  });

  describe('Source Highlighting', () => {
    it('should highlight field source on hover', async () => {
      renderComponent();
      
      const field = screen.getByTestId('field-f1');
      await userEvent.hover(field);
      
      expect(screen.getByText(/page 1/i)).toBeInTheDocument();
      expect(screen.getByText(/coordinates: 100, 50/i)).toBeInTheDocument();
    });

    it('should show original text in tooltip', async () => {
      renderComponent();
      
      const field = screen.getByTestId('field-f1');
      await userEvent.hover(field);
      
      expect(screen.getByText(/original: software license agreement/i)).toBeInTheDocument();
    });

    it('should navigate to source location', async () => {
      const mockOnNavigateToSource = vi.fn();
      renderComponent({ onNavigateToSource: mockOnNavigateToSource });
      
      const field = screen.getByTestId('field-f1');
      const sourceButton = field.querySelector('[aria-label="Go to source"]');
      await userEvent.click(sourceButton!);
      
      expect(mockOnNavigateToSource).toHaveBeenCalledWith({
        page: 1,
        coordinates: { x: 100, y: 50, width: 300, height: 20 },
      });
    });
  });

  describe('Filtering and Search', () => {
    it('should filter fields by confidence level', async () => {
      renderComponent();
      
      const confidenceFilter = screen.getByRole('combobox', { name: /filter by confidence/i });
      await userEvent.selectOptions(confidenceFilter, 'high');
      
      expect(screen.getByText('Contract Title')).toBeInTheDocument();
      expect(screen.queryByText('Contract Value')).not.toBeInTheDocument();
    });

    it('should filter by field category', async () => {
      renderComponent();
      
      const categoryFilter = screen.getByRole('combobox', { name: /filter by category/i });
      await userEvent.selectOptions(categoryFilter, 'Financial');
      
      expect(screen.getByText('Contract Value')).toBeInTheDocument();
      expect(screen.queryByText('Contract Title')).not.toBeInTheDocument();
    });

    it('should search fields by name or value', async () => {
      renderComponent();
      
      const searchInput = screen.getByRole('searchbox', { name: /search fields/i });
      await userEvent.type(searchInput, 'license');
      
      expect(screen.getByText('Contract Title')).toBeInTheDocument();
      expect(screen.getByText('Software License Agreement')).toBeInTheDocument();
      expect(screen.queryByText('Contract Value')).not.toBeInTheDocument();
    });

    it('should show only required fields', async () => {
      renderComponent();
      
      const requiredOnlyToggle = screen.getByRole('checkbox', { name: /show only required/i });
      await userEvent.click(requiredOnlyToggle);
      
      expect(screen.getByText('Contract Title')).toBeInTheDocument();
      expect(screen.getByText('Effective Date')).toBeInTheDocument();
      expect(screen.queryByText('Contract Value')).not.toBeInTheDocument();
    });

    it('should clear all filters', async () => {
      renderComponent();
      
      const categoryFilter = screen.getByRole('combobox', { name: /filter by category/i });
      await userEvent.selectOptions(categoryFilter, 'Financial');
      
      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      await userEvent.click(clearButton);
      
      expect(screen.getByText('Contract Title')).toBeInTheDocument();
      expect(screen.getByText('Contract Value')).toBeInTheDocument();
    });
  });

  describe('Batch Actions', () => {
    it('should allow selecting multiple fields', async () => {
      renderComponent();
      
      const checkbox1 = screen.getAllByRole('checkbox', { name: /select field/i })[0];
      const checkbox2 = screen.getAllByRole('checkbox', { name: /select field/i })[1];
      
      await userEvent.click(checkbox1);
      await userEvent.click(checkbox2);
      
      expect(screen.getByText(/2 fields selected/i)).toBeInTheDocument();
    });

    it('should approve selected fields', async () => {
      renderComponent();
      
      const checkbox1 = screen.getAllByRole('checkbox', { name: /select field/i })[0];
      await userEvent.click(checkbox1);
      
      const approveButton = screen.getByRole('button', { name: /approve selected/i });
      await userEvent.click(approveButton);
      
      expect(mockOnApprove).toHaveBeenCalledWith(['f1']);
    });

    it('should reject selected fields', async () => {
      renderComponent();
      
      const checkbox1 = screen.getAllByRole('checkbox', { name: /select field/i })[0];
      await userEvent.click(checkbox1);
      
      const rejectButton = screen.getByRole('button', { name: /reject selected/i });
      await userEvent.click(rejectButton);
      
      expect(mockOnReject).toHaveBeenCalledWith(['f1']);
    });

    it('should select all fields', async () => {
      renderComponent();
      
      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await userEvent.click(selectAllButton);
      
      expect(screen.getByText(/3 fields selected/i)).toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    it('should export extraction results', async () => {
      renderComponent({ onExport: mockOnExport });
      
      const exportButton = screen.getByRole('button', { name: /export results/i });
      await userEvent.click(exportButton);
      
      const jsonOption = screen.getByRole('menuitem', { name: /export as json/i });
      await userEvent.click(jsonOption);
      
      expect(mockOnExport).toHaveBeenCalledWith('json', extractionResult);
    });

    it('should export in multiple formats', async () => {
      renderComponent({ onExport: mockOnExport });
      
      const exportButton = screen.getByRole('button', { name: /export results/i });
      await userEvent.click(exportButton);
      
      expect(screen.getByRole('menuitem', { name: /export as json/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /export as csv/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /export as excel/i })).toBeInTheDocument();
    });
  });

  describe('Visual Layout', () => {
    it('should switch to grid view', async () => {
      renderComponent();
      
      const gridViewButton = screen.getByRole('button', { name: /grid view/i });
      await userEvent.click(gridViewButton);
      
      const fieldsGrid = screen.getByTestId('fields-grid');
      expect(fieldsGrid).toHaveClass('grid-cols-3');
    });

    it('should switch to list view', async () => {
      renderComponent();
      
      const listViewButton = screen.getByRole('button', { name: /list view/i });
      await userEvent.click(listViewButton);
      
      const fieldsList = screen.getByTestId('fields-list');
      expect(fieldsList).toHaveClass('space-y-2');
    });

    it('should adjust field card size', async () => {
      renderComponent();
      
      const sizeSelector = screen.getByRole('combobox', { name: /card size/i });
      await userEvent.selectOptions(sizeSelector, 'large');
      
      const fieldCard = screen.getByTestId('field-f1');
      expect(fieldCard).toHaveClass('p-6');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('region', { name: /extraction results/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /extracted fields/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /entities/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      const firstField = screen.getByTestId('field-f1');
      firstField.focus();
      
      fireEvent.keyDown(firstField, { key: 'ArrowDown' });
      const secondField = screen.getByTestId('field-f2');
      expect(secondField).toHaveFocus();
    });

    it('should announce confidence levels to screen readers', () => {
      renderComponent();
      
      const highConfidenceField = screen.getByTestId('field-f1');
      expect(highConfidenceField).toHaveAttribute('aria-label', expect.stringContaining('95% confidence'));
    });

    it('should provide field descriptions', () => {
      renderComponent();
      
      const requiredField = screen.getByTestId('field-f1');
      expect(requiredField).toHaveAttribute('aria-describedby', expect.stringContaining('required'));
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of fields efficiently', () => {
      const manyFields = Array.from({ length: 1000 }, (_, i) => ({
        id: `f${i}`,
        name: `Field ${i}`,
        type: 'text' as const,
        value: `Value ${i}`,
        confidence: Math.random(),
        source: {
          page: 1,
          coordinates: { x: 100, y: 100 + i * 20, width: 100, height: 15 },
          originalText: `Original ${i}`,
        },
        category: 'Generated',
        required: false,
      }));
      
      const largeResult = {
        ...extractionResult,
        extractedFields: manyFields,
      };
      
      renderComponent({ extractionResult: largeResult });
      
      expect(screen.getByText(/1000 fields extracted/i)).toBeInTheDocument();
    });

    it('should virtualize long lists', () => {
      const manyFields = Array.from({ length: 1000 }, (_, i) => ({
        id: `f${i}`,
        name: `Field ${i}`,
        type: 'text' as const,
        value: `Value ${i}`,
        confidence: Math.random(),
        source: {
          page: 1,
          coordinates: { x: 100, y: 100 + i * 20, width: 100, height: 15 },
          originalText: `Original ${i}`,
        },
        category: 'Generated',
        required: false,
      }));
      
      const largeResult = {
        ...extractionResult,
        extractedFields: manyFields,
      };
      
      renderComponent({ extractionResult: largeResult });
      
      // Should only render visible fields
      const renderedFields = document.querySelectorAll('[data-testid^="field-"]');
      expect(renderedFields.length).toBeLessThan(100);
    });
  });
});