import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { UploadValidationFeedback } from '../UploadValidationFeedback';

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  fileInfo: FileInfo;
  suggestions: string[];
}

interface ValidationError {
  code: string;
  message: string;
  severity: 'error' | 'critical';
  field?: string;
  details?: string;
}

interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
}

interface FileInfo {
  name: string;
  size: number;
  type: string;
  lastModified: Date;
  checksum?: string;
  pages?: number;
  encrypted?: boolean;
  hasSignatures?: boolean;
  language?: string;
  encoding?: string;
}

describe('UploadValidationFeedback', () => {
  const mockOnProceed = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnRetry = vi.fn();
  const mockOnFixAndRetry = vi.fn();

  const baseFileInfo: FileInfo = {
    name: 'contract.pdf',
    size: 2048000,
    type: 'application/pdf',
    lastModified: new Date('2024-01-15T10:00:00Z'),
    pages: 10,
    encrypted: false,
    hasSignatures: true,
    language: 'en',
    encoding: 'UTF-8',
  };

  const validResult: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    fileInfo: baseFileInfo,
    suggestions: [],
  };

  const invalidResult: ValidationResult = {
    isValid: false,
    errors: [
      {
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds maximum allowed size of 100MB',
        severity: 'error',
        field: 'size',
        details: 'Current size: 150MB, Maximum: 100MB',
      },
      {
        code: 'INVALID_FORMAT',
        message: 'File format is not supported',
        severity: 'critical',
        field: 'type',
        details: 'Supported formats: PDF, DOCX, DOC, TXT',
      },
    ],
    warnings: [
      {
        code: 'NO_OCR',
        message: 'Document appears to be scanned without OCR',
        field: 'content',
        suggestion: 'Consider running OCR for better text extraction',
      },
    ],
    fileInfo: baseFileInfo,
    suggestions: [
      'Reduce file size by compressing images',
      'Convert to supported format',
      'Run OCR on scanned pages',
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      validationResult: validResult,
      isValidating: false,
      onProceed: mockOnProceed,
      onCancel: mockOnCancel,
      ...props,
    };

    return render(<UploadValidationFeedback {...defaultProps} />);
  };

  describe('Rendering', () => {
    it('should render validation in progress state', () => {
      renderComponent({ isValidating: true, validationResult: null });
      
      expect(screen.getByText(/validating document/i)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should render successful validation state', () => {
      renderComponent({ validationResult: validResult });
      
      expect(screen.getByText(/validation successful/i)).toBeInTheDocument();
      expect(screen.getByText(/document passed all validation checks/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /proceed with upload/i })).toBeInTheDocument();
    });

    it('should render failed validation state with errors', () => {
      renderComponent({ validationResult: invalidResult });
      
      expect(screen.getByText(/validation failed/i)).toBeInTheDocument();
      expect(screen.getByText(/2 errors? found/i)).toBeInTheDocument();
      expect(screen.getByText(/1 warnings? found/i)).toBeInTheDocument();
    });

    it('should display file information', () => {
      renderComponent({ validationResult: validResult });
      
      expect(screen.getByText('contract.pdf')).toBeInTheDocument();
      expect(screen.getByText(/2\.00 MB/)).toBeInTheDocument();
      expect(screen.getByText(/10 pages/)).toBeInTheDocument();
      expect(screen.getByText(/PDF Document/)).toBeInTheDocument();
    });

    it('should show encryption status', () => {
      const encryptedResult = {
        ...validResult,
        fileInfo: { ...baseFileInfo, encrypted: true },
      };
      
      renderComponent({ validationResult: encryptedResult });
      
      expect(screen.getByText(/encrypted/i)).toBeInTheDocument();
      expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
    });

    it('should show signature status', () => {
      renderComponent({ validationResult: validResult });
      
      expect(screen.getByText(/contains signatures/i)).toBeInTheDocument();
      expect(screen.getByTestId('signature-icon')).toBeInTheDocument();
    });
  });

  describe('Error Display', () => {
    it('should list all validation errors', () => {
      renderComponent({ validationResult: invalidResult });
      
      expect(screen.getByText(/file size exceeds maximum/i)).toBeInTheDocument();
      expect(screen.getByText(/file format is not supported/i)).toBeInTheDocument();
    });

    it('should show error severity badges', () => {
      renderComponent({ validationResult: invalidResult });
      
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });

    it('should display error details when available', () => {
      renderComponent({ validationResult: invalidResult });
      
      expect(screen.getByText(/current size: 150mb/i)).toBeInTheDocument();
      expect(screen.getByText(/supported formats: pdf, docx/i)).toBeInTheDocument();
    });

    it('should show expandable error details', async () => {
      renderComponent({ validationResult: invalidResult });
      
      const expandButton = screen.getByRole('button', { name: /show details/i });
      await userEvent.click(expandButton);
      
      expect(screen.getByText(/field: size/i)).toBeInTheDocument();
      expect(screen.getByText(/code: file_too_large/i)).toBeInTheDocument();
    });
  });

  describe('Warning Display', () => {
    it('should list all warnings', () => {
      renderComponent({ validationResult: invalidResult });
      
      expect(screen.getByText(/document appears to be scanned/i)).toBeInTheDocument();
    });

    it('should show warning suggestions', () => {
      renderComponent({ validationResult: invalidResult });
      
      expect(screen.getByText(/consider running ocr/i)).toBeInTheDocument();
    });

    it('should allow dismissing warnings', async () => {
      renderComponent({ validationResult: invalidResult });
      
      const dismissButton = screen.getByRole('button', { name: /dismiss warning/i });
      await userEvent.click(dismissButton);
      
      await waitFor(() => {
        expect(screen.queryByText(/document appears to be scanned/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Suggestions', () => {
    it('should display improvement suggestions', () => {
      renderComponent({ validationResult: invalidResult });
      
      expect(screen.getByText(/reduce file size by compressing/i)).toBeInTheDocument();
      expect(screen.getByText(/convert to supported format/i)).toBeInTheDocument();
      expect(screen.getByText(/run ocr on scanned pages/i)).toBeInTheDocument();
    });

    it('should show suggestions in a collapsible section', async () => {
      renderComponent({ validationResult: invalidResult });
      
      const toggleButton = screen.getByRole('button', { name: /view suggestions/i });
      expect(screen.queryByText(/reduce file size/i)).not.toBeVisible();
      
      await userEvent.click(toggleButton);
      expect(screen.getByText(/reduce file size/i)).toBeVisible();
    });
  });

  describe('User Actions', () => {
    it('should call onProceed when proceed button clicked for valid file', async () => {
      renderComponent({ validationResult: validResult });
      
      const proceedButton = screen.getByRole('button', { name: /proceed with upload/i });
      await userEvent.click(proceedButton);
      
      expect(mockOnProceed).toHaveBeenCalledWith(validResult);
    });

    it('should call onCancel when cancel button clicked', async () => {
      renderComponent({ validationResult: validResult });
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);
      
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should call onRetry when retry validation clicked', async () => {
      renderComponent({ 
        validationResult: invalidResult,
        onRetry: mockOnRetry,
      });
      
      const retryButton = screen.getByRole('button', { name: /retry validation/i });
      await userEvent.click(retryButton);
      
      expect(mockOnRetry).toHaveBeenCalled();
    });

    it('should show fix options for errors', async () => {
      renderComponent({ 
        validationResult: invalidResult,
        onFixAndRetry: mockOnFixAndRetry,
      });
      
      const fixButton = screen.getByRole('button', { name: /fix and retry/i });
      await userEvent.click(fixButton);
      
      expect(mockOnFixAndRetry).toHaveBeenCalledWith(invalidResult.errors);
    });

    it('should allow force upload with warnings', async () => {
      const warningOnlyResult = {
        ...validResult,
        warnings: invalidResult.warnings,
      };
      
      renderComponent({ validationResult: warningOnlyResult });
      
      const proceedButton = screen.getByRole('button', { name: /proceed anyway/i });
      await userEvent.click(proceedButton);
      
      expect(mockOnProceed).toHaveBeenCalledWith(warningOnlyResult);
    });

    it('should show confirmation dialog for force upload', async () => {
      renderComponent({ 
        validationResult: invalidResult,
        allowForceUpload: true,
      });
      
      const forceButton = screen.getByRole('button', { name: /upload anyway/i });
      await userEvent.click(forceButton);
      
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      expect(screen.getByText(/document has validation errors/i)).toBeInTheDocument();
      
      const confirmButton = screen.getByRole('button', { name: /confirm upload/i });
      await userEvent.click(confirmButton);
      
      expect(mockOnProceed).toHaveBeenCalledWith(invalidResult);
    });
  });

  describe('Progress Indicators', () => {
    it('should show validation progress with steps', () => {
      const progressResult = {
        ...validResult,
        validationProgress: {
          currentStep: 2,
          totalSteps: 5,
          currentStepName: 'Checking file format',
          completedSteps: ['File size check', 'Virus scan'],
        },
      };
      
      renderComponent({ 
        isValidating: true,
        validationResult: progressResult,
      });
      
      expect(screen.getByText(/step 2 of 5/i)).toBeInTheDocument();
      expect(screen.getByText(/checking file format/i)).toBeInTheDocument();
      expect(screen.getByText(/file size check/i)).toHaveClass('line-through');
    });

    it('should show validation percentage', () => {
      renderComponent({ 
        isValidating: true,
        validationProgress: 75,
      });
      
      expect(screen.getByText('75%')).toBeInTheDocument();
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent({ validationResult: invalidResult });
      
      expect(screen.getByRole('region', { name: /validation results/i })).toBeInTheDocument();
      expect(screen.getByRole('list', { name: /validation errors/i })).toBeInTheDocument();
      expect(screen.getByRole('list', { name: /validation warnings/i })).toBeInTheDocument();
    });

    it('should announce validation status to screen readers', () => {
      renderComponent({ validationResult: invalidResult });
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/validation failed.*2 errors/i);
    });

    it('should support keyboard navigation', async () => {
      renderComponent({ validationResult: invalidResult });
      
      const firstError = screen.getAllByRole('listitem')[0];
      const secondError = screen.getAllByRole('listitem')[1];
      
      firstError.focus();
      fireEvent.keyDown(firstError, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(secondError);
      
      fireEvent.keyDown(secondError, { key: 'ArrowUp' });
      expect(document.activeElement).toBe(firstError);
    });

    it('should have descriptive button labels', () => {
      renderComponent({ 
        validationResult: invalidResult,
        onRetry: mockOnRetry,
        onFixAndRetry: mockOnFixAndRetry,
        allowForceUpload: true,
      });
      
      expect(screen.getByRole('button', { name: /retry validation/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /fix and retry/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /upload anyway/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel upload/i })).toBeInTheDocument();
    });
  });

  describe('Auto-actions', () => {
    it('should auto-proceed if configured for valid files', async () => {
      renderComponent({ 
        validationResult: validResult,
        autoProceedOnSuccess: true,
      });
      
      await waitFor(() => {
        expect(mockOnProceed).toHaveBeenCalledWith(validResult);
      }, { timeout: 3000 });
    });

    it('should not auto-proceed for invalid files', async () => {
      renderComponent({ 
        validationResult: invalidResult,
        autoProceedOnSuccess: true,
      });
      
      await waitFor(() => {
        expect(mockOnProceed).not.toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('should auto-retry on specific errors if configured', async () => {
      const retryableResult = {
        ...invalidResult,
        errors: [{
          code: 'NETWORK_ERROR',
          message: 'Network error during validation',
          severity: 'error' as const,
        }],
      };
      
      renderComponent({ 
        validationResult: retryableResult,
        autoRetryOnErrors: ['NETWORK_ERROR'],
        onRetry: mockOnRetry,
      });
      
      await waitFor(() => {
        expect(mockOnRetry).toHaveBeenCalled();
      }, { timeout: 2000 });
    });
  });

  describe('Export and Reporting', () => {
    it('should allow exporting validation report', async () => {
      const mockOnExport = vi.fn();
      
      renderComponent({ 
        validationResult: invalidResult,
        onExportReport: mockOnExport,
      });
      
      const exportButton = screen.getByRole('button', { name: /export report/i });
      await userEvent.click(exportButton);
      
      expect(mockOnExport).toHaveBeenCalledWith(invalidResult);
    });

    it('should copy validation details to clipboard', async () => {
      const mockWriteText = vi.fn();
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText },
      });
      
      renderComponent({ validationResult: invalidResult });
      
      const copyButton = screen.getByRole('button', { name: /copy details/i });
      await userEvent.click(copyButton);
      
      expect(mockWriteText).toHaveBeenCalled();
      expect(screen.getByText(/copied to clipboard/i)).toBeInTheDocument();
    });
  });
});