import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MetadataForm } from '../MetadataForm';

describe('MetadataForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();
  
  const defaultProps = {
    fileName: 'test-contract.pdf',
    fileSize: 1048576, // 1MB
    onSubmit: mockOnSubmit,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render metadata form with all fields', () => {
      render(<MetadataForm {...defaultProps} />);
      
      expect(screen.getByText('Document Metadata')).toBeInTheDocument();
      expect(screen.getByText('test-contract.pdf')).toBeInTheDocument();
      expect(screen.getByText('(1.00 MB)')).toBeInTheDocument();
      
      expect(screen.getByLabelText(/document title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/document type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/contract party 1/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/contract party 2/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/effective date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/expiration date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/contract value/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/department/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confidentiality level/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/auto-extract metadata/i)).toBeInTheDocument();
    });

    it('should render with initial values when provided', () => {
      const initialValues = {
        title: 'Service Agreement',
        documentType: 'service_agreement',
        description: 'Annual service contract',
        party1: 'Acme Corp',
        party2: 'Service Provider Inc',
        effectiveDate: '2024-01-01',
        expirationDate: '2024-12-31',
        contractValue: 50000,
        currency: 'USD',
        department: 'IT',
        tags: ['annual', 'service', 'it'],
        confidentialityLevel: 'confidential',
        autoExtract: false,
      };
      
      render(<MetadataForm {...defaultProps} initialValues={initialValues} />);
      
      expect(screen.getByDisplayValue('Service Agreement')).toBeInTheDocument();
      expect(screen.getByDisplayValue('service_agreement')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Annual service contract')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Service Provider Inc')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2024-01-01')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2024-12-31')).toBeInTheDocument();
      expect(screen.getByDisplayValue('50000')).toBeInTheDocument();
      expect(screen.getByDisplayValue('USD')).toBeInTheDocument();
      expect(screen.getByDisplayValue('IT')).toBeInTheDocument();
      expect(screen.getByDisplayValue('annual, service, it')).toBeInTheDocument();
      expect(screen.getByDisplayValue('confidential')).toBeInTheDocument();
      expect(screen.getByLabelText(/auto-extract metadata/i)).not.toBeChecked();
    });

    it('should show required field indicators', () => {
      render(<MetadataForm {...defaultProps} />);
      
      const titleLabel = screen.getByText(/document title/i);
      const typeLabel = screen.getByText(/document type/i);
      
      expect(titleLabel.closest('label')?.querySelector('.text-red-500')).toBeInTheDocument();
      expect(typeLabel.closest('label')?.querySelector('.text-red-500')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should require title field', async () => {
      render(<MetadataForm {...defaultProps} />);
      
      const submitBtn = screen.getByRole('button', { name: /save metadata/i });
      await userEvent.click(submitBtn);
      
      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });
    });

    it('should require document type field', async () => {
      render(<MetadataForm {...defaultProps} />);
      
      const titleInput = screen.getByLabelText(/document title/i);
      await userEvent.type(titleInput, 'Test Document');
      
      const submitBtn = screen.getByRole('button', { name: /save metadata/i });
      await userEvent.click(submitBtn);
      
      await waitFor(() => {
        expect(screen.getByText(/document type is required/i)).toBeInTheDocument();
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });
    });

    it('should validate date range', async () => {
      render(<MetadataForm {...defaultProps} />);
      
      const effectiveDate = screen.getByLabelText(/effective date/i);
      const expirationDate = screen.getByLabelText(/expiration date/i);
      
      await userEvent.type(effectiveDate, '2024-12-31');
      await userEvent.type(expirationDate, '2024-01-01');
      
      const submitBtn = screen.getByRole('button', { name: /save metadata/i });
      await userEvent.click(submitBtn);
      
      await waitFor(() => {
        expect(screen.getByText(/expiration date must be after effective date/i)).toBeInTheDocument();
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });
    });

    it('should validate contract value as positive number', async () => {
      render(<MetadataForm {...defaultProps} />);
      
      const valueInput = screen.getByLabelText(/contract value/i);
      await userEvent.type(valueInput, '-1000');
      
      const submitBtn = screen.getByRole('button', { name: /save metadata/i });
      await userEvent.click(submitBtn);
      
      await waitFor(() => {
        expect(screen.getByText(/contract value must be positive/i)).toBeInTheDocument();
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });
    });

    it('should validate email format for notification emails', async () => {
      render(<MetadataForm {...defaultProps} />);
      
      const emailInput = screen.getByLabelText(/notification emails/i);
      await userEvent.type(emailInput, 'invalid-email');
      
      fireEvent.blur(emailInput);
      
      await waitFor(() => {
        expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit form with all data when valid', async () => {
      render(<MetadataForm {...defaultProps} />);
      
      // Fill required fields
      await userEvent.type(screen.getByLabelText(/document title/i), 'Test Contract');
      await userEvent.selectOptions(screen.getByLabelText(/document type/i), 'purchase_agreement');
      
      // Fill optional fields
      await userEvent.type(screen.getByLabelText(/description/i), 'Test description');
      await userEvent.type(screen.getByLabelText(/contract party 1/i), 'Party A');
      await userEvent.type(screen.getByLabelText(/contract party 2/i), 'Party B');
      await userEvent.type(screen.getByLabelText(/effective date/i), '2024-01-01');
      await userEvent.type(screen.getByLabelText(/expiration date/i), '2024-12-31');
      await userEvent.type(screen.getByLabelText(/contract value/i), '100000');
      await userEvent.selectOptions(screen.getByLabelText(/currency/i), 'EUR');
      await userEvent.selectOptions(screen.getByLabelText(/department/i), 'Legal');
      await userEvent.type(screen.getByLabelText(/tags/i), 'important, review, 2024');
      await userEvent.selectOptions(screen.getByLabelText(/confidentiality level/i), 'highly_confidential');
      await userEvent.click(screen.getByLabelText(/auto-extract metadata/i));
      
      const submitBtn = screen.getByRole('button', { name: /save metadata/i });
      await userEvent.click(submitBtn);
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          title: 'Test Contract',
          documentType: 'purchase_agreement',
          description: 'Test description',
          party1: 'Party A',
          party2: 'Party B',
          effectiveDate: '2024-01-01',
          expirationDate: '2024-12-31',
          contractValue: 100000,
          currency: 'EUR',
          department: 'Legal',
          tags: ['important', 'review', '2024'],
          confidentialityLevel: 'highly_confidential',
          autoExtract: true,
          notificationEmails: [],
          customFields: {},
        });
      });
    });

    it('should handle tag input correctly', async () => {
      render(<MetadataForm {...defaultProps} />);
      
      const tagInput = screen.getByLabelText(/tags/i);
      await userEvent.type(tagInput, 'tag1, tag2,  tag3  ,tag4');
      
      // Fill required fields
      await userEvent.type(screen.getByLabelText(/document title/i), 'Test');
      await userEvent.selectOptions(screen.getByLabelText(/document type/i), 'nda');
      
      const submitBtn = screen.getByRole('button', { name: /save metadata/i });
      await userEvent.click(submitBtn);
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            tags: ['tag1', 'tag2', 'tag3', 'tag4'],
          })
        );
      });
    });

    it('should handle multiple notification emails', async () => {
      render(<MetadataForm {...defaultProps} />);
      
      const emailInput = screen.getByLabelText(/notification emails/i);
      await userEvent.type(emailInput, 'user1@example.com, user2@example.com');
      
      // Fill required fields
      await userEvent.type(screen.getByLabelText(/document title/i), 'Test');
      await userEvent.selectOptions(screen.getByLabelText(/document type/i), 'nda');
      
      const submitBtn = screen.getByRole('button', { name: /save metadata/i });
      await userEvent.click(submitBtn);
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            notificationEmails: ['user1@example.com', 'user2@example.com'],
          })
        );
      });
    });
  });

  describe('Custom Fields', () => {
    it('should allow adding custom fields', async () => {
      render(<MetadataForm {...defaultProps} />);
      
      const addFieldBtn = screen.getByRole('button', { name: /add custom field/i });
      await userEvent.click(addFieldBtn);
      
      expect(screen.getByPlaceholderText(/field name/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/field value/i)).toBeInTheDocument();
    });

    it('should allow removing custom fields', async () => {
      render(<MetadataForm {...defaultProps} />);
      
      const addFieldBtn = screen.getByRole('button', { name: /add custom field/i });
      await userEvent.click(addFieldBtn);
      
      const removeBtn = screen.getByRole('button', { name: /remove field/i });
      await userEvent.click(removeBtn);
      
      expect(screen.queryByPlaceholderText(/field name/i)).not.toBeInTheDocument();
    });

    it('should submit custom fields with form', async () => {
      render(<MetadataForm {...defaultProps} />);
      
      // Add custom field
      const addFieldBtn = screen.getByRole('button', { name: /add custom field/i });
      await userEvent.click(addFieldBtn);
      
      await userEvent.type(screen.getByPlaceholderText(/field name/i), 'Project Code');
      await userEvent.type(screen.getByPlaceholderText(/field value/i), 'PROJ-2024-001');
      
      // Fill required fields
      await userEvent.type(screen.getByLabelText(/document title/i), 'Test');
      await userEvent.selectOptions(screen.getByLabelText(/document type/i), 'nda');
      
      const submitBtn = screen.getByRole('button', { name: /save metadata/i });
      await userEvent.click(submitBtn);
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            customFields: {
              'Project Code': 'PROJ-2024-001',
            },
          })
        );
      });
    });

    it('should validate custom field names are unique', async () => {
      render(<MetadataForm {...defaultProps} />);
      
      const addFieldBtn = screen.getByRole('button', { name: /add custom field/i });
      
      // Add first field
      await userEvent.click(addFieldBtn);
      const fieldNames = screen.getAllByPlaceholderText(/field name/i);
      await userEvent.type(fieldNames[0], 'CustomField');
      
      // Add second field with same name
      await userEvent.click(addFieldBtn);
      const newFieldNames = screen.getAllByPlaceholderText(/field name/i);
      await userEvent.type(newFieldNames[1], 'CustomField');
      
      fireEvent.blur(newFieldNames[1]);
      
      await waitFor(() => {
        expect(screen.getByText(/field name must be unique/i)).toBeInTheDocument();
      });
    });
  });

  describe('Auto-Extract Feature', () => {
    it('should trigger auto-extract when checkbox is checked', async () => {
      const mockOnAutoExtract = vi.fn();
      render(<MetadataForm {...defaultProps} onAutoExtract={mockOnAutoExtract} />);
      
      const autoExtractCheckbox = screen.getByLabelText(/auto-extract metadata/i);
      await userEvent.click(autoExtractCheckbox);
      
      expect(mockOnAutoExtract).toHaveBeenCalledWith(true);
    });

    it('should show loading state during auto-extraction', () => {
      render(<MetadataForm {...defaultProps} isExtracting={true} />);
      
      expect(screen.getByText(/extracting metadata/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save metadata/i })).toBeDisabled();
    });

    it('should populate fields with extracted data', async () => {
      const { rerender } = render(<MetadataForm {...defaultProps} />);
      
      const extractedData = {
        title: 'Extracted Title',
        documentType: 'service_agreement',
        party1: 'Extracted Party A',
        party2: 'Extracted Party B',
        effectiveDate: '2024-03-01',
        contractValue: 75000,
      };
      
      rerender(<MetadataForm {...defaultProps} extractedData={extractedData} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Extracted Title')).toBeInTheDocument();
        expect(screen.getByDisplayValue('service_agreement')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Extracted Party A')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Extracted Party B')).toBeInTheDocument();
        expect(screen.getByDisplayValue('2024-03-01')).toBeInTheDocument();
        expect(screen.getByDisplayValue('75000')).toBeInTheDocument();
      });
    });

    it('should show extraction error when it fails', () => {
      render(<MetadataForm {...defaultProps} extractionError="Failed to extract metadata" />);
      
      expect(screen.getByText(/failed to extract metadata/i)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveClass('text-red-600');
    });
  });

  describe('Cancel Operation', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      render(<MetadataForm {...defaultProps} />);
      
      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelBtn);
      
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should show confirmation dialog if form has unsaved changes', async () => {
      render(<MetadataForm {...defaultProps} />);
      
      // Make changes
      await userEvent.type(screen.getByLabelText(/document title/i), 'Test');
      
      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelBtn);
      
      expect(screen.getByText(/you have unsaved changes/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /discard changes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /keep editing/i })).toBeInTheDocument();
    });

    it('should not show confirmation dialog if no changes made', async () => {
      render(<MetadataForm {...defaultProps} />);
      
      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelBtn);
      
      expect(screen.queryByText(/you have unsaved changes/i)).not.toBeInTheDocument();
      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<MetadataForm {...defaultProps} />);
      
      expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Document metadata form');
      expect(screen.getByLabelText(/document title/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/document type/i)).toHaveAttribute('aria-required', 'true');
    });

    it('should show error messages with proper ARIA attributes', async () => {
      render(<MetadataForm {...defaultProps} />);
      
      const submitBtn = screen.getByRole('button', { name: /save metadata/i });
      await userEvent.click(submitBtn);
      
      await waitFor(() => {
        const titleInput = screen.getByLabelText(/document title/i);
        const errorId = titleInput.getAttribute('aria-describedby');
        expect(errorId).toBeTruthy();
        expect(document.getElementById(errorId!)).toHaveTextContent(/title is required/i);
      });
    });

    it('should support keyboard navigation', async () => {
      render(<MetadataForm {...defaultProps} />);
      
      const titleInput = screen.getByLabelText(/document title/i);
      const typeSelect = screen.getByLabelText(/document type/i);
      
      titleInput.focus();
      expect(document.activeElement).toBe(titleInput);
      
      // Tab to next field
      fireEvent.keyDown(titleInput, { key: 'Tab' });
      expect(document.activeElement).toBe(typeSelect);
    });

    it('should announce form submission status to screen readers', async () => {
      render(<MetadataForm {...defaultProps} />);
      
      // Fill required fields
      await userEvent.type(screen.getByLabelText(/document title/i), 'Test');
      await userEvent.selectOptions(screen.getByLabelText(/document type/i), 'nda');
      
      const submitBtn = screen.getByRole('button', { name: /save metadata/i });
      await userEvent.click(submitBtn);
      
      await waitFor(() => {
        const alert = screen.getByRole('status');
        expect(alert).toHaveTextContent(/metadata saved successfully/i);
      });
    });
  });

  describe('Responsive Design', () => {
    it('should render in single column on small screens', () => {
      // Mock window.matchMedia for mobile view
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(max-width: 640px)',
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      });
      
      render(<MetadataForm {...defaultProps} />);
      
      const form = screen.getByRole('form');
      expect(form.querySelector('.grid-cols-1')).toBeInTheDocument();
    });

    it('should render in two columns on larger screens', () => {
      // Mock window.matchMedia for desktop view
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(min-width: 641px)',
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      });
      
      render(<MetadataForm {...defaultProps} />);
      
      const form = screen.getByRole('form');
      expect(form.querySelector('.md\\:grid-cols-2')).toBeInTheDocument();
    });
  });
});