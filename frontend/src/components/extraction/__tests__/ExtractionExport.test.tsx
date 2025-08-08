import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ExtractionExport } from '../ExtractionExport';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface ExtractionField {
  id: string;
  name: string;
  value: any;
  type: 'text' | 'date' | 'number' | 'currency' | 'entity' | 'boolean' | 'list';
  confidence: number;
  category: string;
  source?: {
    page: number;
    coordinates?: { x: number; y: number; width: number; height: number };
  };
  validated: boolean;
  required: boolean;
  metadata?: Record<string, any>;
}

interface ExtractionData {
  documentId: string;
  documentName: string;
  documentType: string;
  extractedAt: string;
  fields: ExtractionField[];
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
    occurrences: number;
  }>;
  metadata: {
    pages: number;
    language: string;
    processingTime: number;
    extractorVersion: string;
  };
  validationStatus: 'pending' | 'validated' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
}

interface ExportFormat {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  description: string;
  icon: string;
  supportedFields: string[];
}

interface ExportTemplate {
  id: string;
  name: string;
  format: string;
  fields: string[];
  transformations: Record<string, any>;
  isDefault: boolean;
  createdAt: string;
  updatedBy: string;
}

interface ExtractionExportProps {
  extractionData: ExtractionData;
  availableFormats?: ExportFormat[];
  templates?: ExportTemplate[];
  onExport: (format: string, options: any) => Promise<void>;
  onSaveTemplate?: (template: Omit<ExportTemplate, 'id' | 'createdAt'>) => Promise<void>;
  onScheduleExport?: (schedule: any) => Promise<void>;
  permissions?: {
    canExport: boolean;
    canSaveTemplates: boolean;
    canSchedule: boolean;
  };
  maxFileSize?: number;
  isLoading?: boolean;
}

// Mock API
vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('ExtractionExport', () => {
  let queryClient: QueryClient;
  const mockOnExport = vi.fn();
  const mockOnSaveTemplate = vi.fn();
  const mockOnScheduleExport = vi.fn();

  const sampleExtractionData: ExtractionData = {
    documentId: 'doc1',
    documentName: 'Contract_ABC_2024.pdf',
    documentType: 'Purchase Agreement',
    extractedAt: '2024-06-15T10:30:00Z',
    fields: [
      {
        id: 'field1',
        name: 'Contract Title',
        value: 'Service Agreement ABC',
        type: 'text',
        confidence: 0.95,
        category: 'general',
        source: { page: 1 },
        validated: true,
        required: true,
      },
      {
        id: 'field2',
        name: 'Contract Value',
        value: 150000,
        type: 'currency',
        confidence: 0.92,
        category: 'financial',
        source: { page: 3 },
        validated: true,
        required: true,
        metadata: { currency: 'USD' },
      },
      {
        id: 'field3',
        name: 'Start Date',
        value: '2024-07-01',
        type: 'date',
        confidence: 0.98,
        category: 'dates',
        source: { page: 2 },
        validated: true,
        required: true,
      },
      {
        id: 'field4',
        name: 'Parties',
        value: ['Company A', 'Company B'],
        type: 'list',
        confidence: 0.89,
        category: 'entities',
        source: { page: 1 },
        validated: false,
        required: true,
      },
    ],
    entities: [
      { type: 'organization', value: 'Company A', confidence: 0.94, occurrences: 5 },
      { type: 'organization', value: 'Company B', confidence: 0.91, occurrences: 4 },
      { type: 'person', value: 'John Doe', confidence: 0.88, occurrences: 2 },
    ],
    metadata: {
      pages: 15,
      language: 'en',
      processingTime: 3500,
      extractorVersion: '2.1.0',
    },
    validationStatus: 'validated',
    approvedBy: 'Jane Smith',
    approvedAt: '2024-06-15T11:00:00Z',
  };

  const availableFormats: ExportFormat[] = [
    {
      id: 'json',
      name: 'JSON',
      extension: '.json',
      mimeType: 'application/json',
      description: 'JavaScript Object Notation - Full data structure',
      icon: '{ }',
      supportedFields: ['all'],
    },
    {
      id: 'csv',
      name: 'CSV',
      extension: '.csv',
      mimeType: 'text/csv',
      description: 'Comma-Separated Values - Tabular data',
      icon: '📊',
      supportedFields: ['text', 'number', 'currency', 'date', 'boolean'],
    },
    {
      id: 'excel',
      name: 'Excel',
      extension: '.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      description: 'Microsoft Excel - Spreadsheet with formatting',
      icon: '📈',
      supportedFields: ['all'],
    },
    {
      id: 'xml',
      name: 'XML',
      extension: '.xml',
      mimeType: 'application/xml',
      description: 'Extensible Markup Language - Structured data',
      icon: '< >',
      supportedFields: ['all'],
    },
    {
      id: 'pdf',
      name: 'PDF Report',
      extension: '.pdf',
      mimeType: 'application/pdf',
      description: 'Formatted report with extraction results',
      icon: '📄',
      supportedFields: ['all'],
    },
  ];

  const sampleTemplates: ExportTemplate[] = [
    {
      id: 'template1',
      name: 'Financial Summary',
      format: 'excel',
      fields: ['Contract Value', 'Start Date', 'End Date', 'Payment Terms'],
      transformations: { dateFormat: 'MM/DD/YYYY', currencySymbol: '$' },
      isDefault: true,
      createdAt: '2024-05-01T10:00:00Z',
      updatedBy: 'Admin',
    },
    {
      id: 'template2',
      name: 'Legal Review',
      format: 'pdf',
      fields: ['Contract Title', 'Parties', 'Governing Law', 'Jurisdiction'],
      transformations: { includeMetadata: true, includeConfidence: true },
      isDefault: false,
      createdAt: '2024-05-15T14:00:00Z',
      updatedBy: 'Legal Team',
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
      extractionData: sampleExtractionData,
      availableFormats,
      templates: sampleTemplates,
      onExport: mockOnExport,
      onSaveTemplate: mockOnSaveTemplate,
      onScheduleExport: mockOnScheduleExport,
      permissions: {
        canExport: true,
        canSaveTemplates: true,
        canSchedule: true,
      },
      ...props,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <ExtractionExport {...defaultProps} />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render export interface', () => {
      renderComponent();
      
      expect(screen.getByText('Export Extraction Results')).toBeInTheDocument();
      expect(screen.getByTestId('extraction-export')).toBeInTheDocument();
    });

    it('should display document information', () => {
      renderComponent();
      
      expect(screen.getByText('Contract_ABC_2024.pdf')).toBeInTheDocument();
      expect(screen.getByText('Purchase Agreement')).toBeInTheDocument();
      expect(screen.getByText('15 pages')).toBeInTheDocument();
    });

    it('should show available export formats', () => {
      renderComponent();
      
      availableFormats.forEach(format => {
        expect(screen.getByText(format.name)).toBeInTheDocument();
        expect(screen.getByText(format.description)).toBeInTheDocument();
      });
    });

    it('should display field selection', () => {
      renderComponent();
      
      expect(screen.getByText('Select Fields to Export')).toBeInTheDocument();
      sampleExtractionData.fields.forEach(field => {
        expect(screen.getByText(field.name)).toBeInTheDocument();
      });
    });

    it('should show loading state', () => {
      renderComponent({ isLoading: true });
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Preparing export...')).toBeInTheDocument();
    });
  });

  describe('Format Selection', () => {
    it('should select export format', async () => {
      renderComponent();
      
      const jsonFormat = screen.getByTestId('format-json');
      fireEvent.click(jsonFormat);
      
      expect(jsonFormat).toHaveClass('selected');
    });

    it('should show format-specific options', async () => {
      renderComponent();
      
      const csvFormat = screen.getByTestId('format-csv');
      fireEvent.click(csvFormat);
      
      await waitFor(() => {
        expect(screen.getByLabelText('Delimiter')).toBeInTheDocument();
        expect(screen.getByLabelText('Include headers')).toBeInTheDocument();
      });
    });

    it('should display unsupported fields warning for CSV', async () => {
      renderComponent();
      
      const csvFormat = screen.getByTestId('format-csv');
      fireEvent.click(csvFormat);
      
      expect(screen.getByText(/List fields not supported in CSV/)).toBeInTheDocument();
    });

    it('should preview export format', async () => {
      renderComponent();
      
      const jsonFormat = screen.getByTestId('format-json');
      fireEvent.click(jsonFormat);
      
      const previewButton = screen.getByRole('button', { name: /preview/i });
      fireEvent.click(previewButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('format-preview')).toBeInTheDocument();
      });
    });
  });

  describe('Field Selection', () => {
    it('should select/deselect fields', async () => {
      renderComponent();
      
      const field1Checkbox = screen.getByRole('checkbox', { name: /Contract Title/i });
      fireEvent.click(field1Checkbox);
      
      expect(field1Checkbox).not.toBeChecked();
      
      fireEvent.click(field1Checkbox);
      expect(field1Checkbox).toBeChecked();
    });

    it('should select all fields', async () => {
      renderComponent();
      
      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      fireEvent.click(selectAllButton);
      
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });
    });

    it('should deselect all fields', async () => {
      renderComponent();
      
      const deselectAllButton = screen.getByRole('button', { name: /deselect all/i });
      fireEvent.click(deselectAllButton);
      
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked();
      });
    });

    it('should filter fields by category', async () => {
      renderComponent();
      
      const categoryFilter = screen.getByLabelText('Filter by category');
      fireEvent.change(categoryFilter, { target: { value: 'financial' } });
      
      expect(screen.getByText('Contract Value')).toBeInTheDocument();
      expect(screen.queryByText('Contract Title')).not.toBeInTheDocument();
    });

    it('should search fields', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search fields...');
      await userEvent.type(searchInput, 'value');
      
      expect(screen.getByText('Contract Value')).toBeInTheDocument();
      expect(screen.queryByText('Contract Title')).not.toBeInTheDocument();
    });

    it('should show field confidence scores', () => {
      renderComponent();
      
      expect(screen.getByText('95%')).toBeInTheDocument(); // Contract Title confidence
      expect(screen.getByText('92%')).toBeInTheDocument(); // Contract Value confidence
    });
  });

  describe('Templates', () => {
    it('should display available templates', () => {
      renderComponent();
      
      expect(screen.getByText('Financial Summary')).toBeInTheDocument();
      expect(screen.getByText('Legal Review')).toBeInTheDocument();
    });

    it('should apply template', async () => {
      renderComponent();
      
      const template = screen.getByTestId('template-template1');
      fireEvent.click(template);
      
      const applyButton = within(template).getByRole('button', { name: /apply/i });
      fireEvent.click(applyButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('format-excel')).toHaveClass('selected');
      });
    });

    it('should create new template', async () => {
      renderComponent();
      
      const createButton = screen.getByRole('button', { name: /create template/i });
      fireEvent.click(createButton);
      
      const nameInput = screen.getByLabelText('Template name');
      await userEvent.type(nameInput, 'My Template');
      
      const saveButton = screen.getByRole('button', { name: /save template/i });
      fireEvent.click(saveButton);
      
      expect(mockOnSaveTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Template',
        })
      );
    });

    it('should edit template', async () => {
      renderComponent();
      
      const template = screen.getByTestId('template-template1');
      const editButton = within(template).getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);
      
      expect(screen.getByTestId('template-editor')).toBeInTheDocument();
    });

    it('should delete template', async () => {
      renderComponent();
      
      const template = screen.getByTestId('template-template2');
      const deleteButton = within(template).getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Legal Review')).not.toBeInTheDocument();
      });
    });
  });

  describe('Export Options', () => {
    it('should configure export options', async () => {
      renderComponent();
      
      const includeMetadata = screen.getByLabelText('Include metadata');
      fireEvent.click(includeMetadata);
      
      expect(includeMetadata).toBeChecked();
    });

    it('should set date format', async () => {
      renderComponent();
      
      const dateFormat = screen.getByLabelText('Date format');
      fireEvent.change(dateFormat, { target: { value: 'DD/MM/YYYY' } });
      
      expect(dateFormat.value).toBe('DD/MM/YYYY');
    });

    it('should set currency format', async () => {
      renderComponent();
      
      const currencyFormat = screen.getByLabelText('Currency format');
      fireEvent.change(currencyFormat, { target: { value: 'EUR' } });
      
      expect(currencyFormat.value).toBe('EUR');
    });

    it('should configure CSV delimiter', async () => {
      renderComponent();
      
      const csvFormat = screen.getByTestId('format-csv');
      fireEvent.click(csvFormat);
      
      const delimiter = screen.getByLabelText('Delimiter');
      fireEvent.change(delimiter, { target: { value: ';' } });
      
      expect(delimiter.value).toBe(';');
    });

    it('should set Excel sheet names', async () => {
      renderComponent();
      
      const excelFormat = screen.getByTestId('format-excel');
      fireEvent.click(excelFormat);
      
      const sheetName = screen.getByLabelText('Sheet name');
      await userEvent.clear(sheetName);
      await userEvent.type(sheetName, 'Extraction Data');
      
      expect(sheetName.value).toBe('Extraction Data');
    });
  });

  describe('Data Transformation', () => {
    it('should apply field transformations', async () => {
      renderComponent();
      
      const transformButton = screen.getByRole('button', { name: /transformations/i });
      fireEvent.click(transformButton);
      
      const uppercaseOption = screen.getByLabelText('Convert to uppercase');
      fireEvent.click(uppercaseOption);
      
      expect(uppercaseOption).toBeChecked();
    });

    it('should flatten nested data', async () => {
      renderComponent();
      
      const flattenOption = screen.getByLabelText('Flatten nested fields');
      fireEvent.click(flattenOption);
      
      expect(flattenOption).toBeChecked();
    });

    it('should rename fields', async () => {
      renderComponent();
      
      const field1 = screen.getByTestId('field-field1');
      const renameButton = within(field1).getByRole('button', { name: /rename/i });
      fireEvent.click(renameButton);
      
      const newNameInput = screen.getByLabelText('New field name');
      await userEvent.type(newNameInput, 'Agreement Title');
      
      const applyButton = screen.getByRole('button', { name: /apply/i });
      fireEvent.click(applyButton);
      
      expect(screen.getByText('Agreement Title')).toBeInTheDocument();
    });

    it('should filter by confidence threshold', async () => {
      renderComponent();
      
      const thresholdSlider = screen.getByLabelText('Minimum confidence');
      fireEvent.change(thresholdSlider, { target: { value: '90' } });
      
      expect(screen.queryByText('Parties')).not.toBeInTheDocument(); // confidence 0.89
    });
  });

  describe('Export Execution', () => {
    it('should export with selected format', async () => {
      renderComponent();
      
      const jsonFormat = screen.getByTestId('format-json');
      fireEvent.click(jsonFormat);
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);
      
      expect(mockOnExport).toHaveBeenCalledWith('json', expect.any(Object));
    });

    it('should validate field selection', async () => {
      renderComponent();
      
      const deselectAllButton = screen.getByRole('button', { name: /deselect all/i });
      fireEvent.click(deselectAllButton);
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);
      
      expect(screen.getByText(/Please select at least one field/)).toBeInTheDocument();
    });

    it('should show export progress', async () => {
      mockOnExport.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
      
      renderComponent();
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);
      
      expect(screen.getByText(/Exporting.../)).toBeInTheDocument();
    });

    it('should handle export errors', async () => {
      mockOnExport.mockRejectedValue(new Error('Export failed'));
      
      renderComponent();
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Export failed/)).toBeInTheDocument();
      });
    });

    it('should download exported file', async () => {
      mockOnExport.mockResolvedValue({ url: 'blob:123', filename: 'export.json' });
      
      renderComponent();
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Download complete/)).toBeInTheDocument();
      });
    });
  });

  describe('Scheduling', () => {
    it('should open schedule dialog', () => {
      renderComponent();
      
      const scheduleButton = screen.getByRole('button', { name: /schedule export/i });
      fireEvent.click(scheduleButton);
      
      expect(screen.getByTestId('schedule-dialog')).toBeInTheDocument();
    });

    it('should configure export schedule', async () => {
      renderComponent();
      
      const scheduleButton = screen.getByRole('button', { name: /schedule export/i });
      fireEvent.click(scheduleButton);
      
      const frequencySelect = screen.getByLabelText('Frequency');
      fireEvent.change(frequencySelect, { target: { value: 'daily' } });
      
      const timeInput = screen.getByLabelText('Time');
      fireEvent.change(timeInput, { target: { value: '09:00' } });
      
      const saveButton = screen.getByRole('button', { name: /save schedule/i });
      fireEvent.click(saveButton);
      
      expect(mockOnScheduleExport).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency: 'daily',
          time: '09:00',
        })
      );
    });

    it('should set email recipients for scheduled export', async () => {
      renderComponent();
      
      const scheduleButton = screen.getByRole('button', { name: /schedule export/i });
      fireEvent.click(scheduleButton);
      
      const emailInput = screen.getByLabelText('Email recipients');
      await userEvent.type(emailInput, 'user@example.com, admin@example.com');
      
      expect(emailInput.value).toBe('user@example.com, admin@example.com');
    });

    it('should disable scheduling without permission', () => {
      renderComponent({ permissions: { canSchedule: false } });
      
      const scheduleButton = screen.queryByRole('button', { name: /schedule export/i });
      expect(scheduleButton).not.toBeInTheDocument();
    });
  });

  describe('Preview', () => {
    it('should preview export data', async () => {
      renderComponent();
      
      const previewButton = screen.getByRole('button', { name: /preview/i });
      fireEvent.click(previewButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('export-preview')).toBeInTheDocument();
        expect(screen.getByText(/Service Agreement ABC/)).toBeInTheDocument();
      });
    });

    it('should show preview in selected format', async () => {
      renderComponent();
      
      const csvFormat = screen.getByTestId('format-csv');
      fireEvent.click(csvFormat);
      
      const previewButton = screen.getByRole('button', { name: /preview/i });
      fireEvent.click(previewButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('csv-preview')).toBeInTheDocument();
      });
    });

    it('should limit preview rows', async () => {
      renderComponent();
      
      const previewButton = screen.getByRole('button', { name: /preview/i });
      fireEvent.click(previewButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Showing first 10 rows/)).toBeInTheDocument();
      });
    });
  });

  describe('Permissions', () => {
    it('should disable export without permission', () => {
      renderComponent({ permissions: { canExport: false } });
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      expect(exportButton).toBeDisabled();
    });

    it('should hide template creation without permission', () => {
      renderComponent({ permissions: { canSaveTemplates: false } });
      
      const createButton = screen.queryByRole('button', { name: /create template/i });
      expect(createButton).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('region', { name: /export options/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /field selection/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      const firstFormat = screen.getByTestId('format-json');
      firstFormat.focus();
      
      fireEvent.keyDown(firstFormat, { key: 'ArrowRight' });
      
      expect(screen.getByTestId('format-csv')).toHaveFocus();
    });

    it('should announce export completion', async () => {
      renderComponent();
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        const status = screen.getByRole('status');
        expect(status).toHaveTextContent(/Export completed/);
      });
    });
  });
});