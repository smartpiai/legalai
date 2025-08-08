import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { RequestIntakeSystem } from '../RequestIntakeSystem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
vi.mock('../../../services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: 'user1',
      email: 'test@example.com',
      permissions: ['create_requests', 'manage_templates'],
    },
  }),
}));

describe('RequestIntakeSystem', () => {
  let queryClient: QueryClient;
  const mockOnSubmit = vi.fn();
  const mockOnSave = vi.fn();

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
    return render(
      <QueryClientProvider client={queryClient}>
        <RequestIntakeSystem
          onSubmit={mockOnSubmit}
          onSave={mockOnSave}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  describe('Initial Render', () => {
    it('should render the request intake system', () => {
      renderComponent();
      
      expect(screen.getByTestId('request-intake-system')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /new request/i })).toBeInTheDocument();
    });

    it('should show step 1 by default', () => {
      renderComponent();
      
      expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
      expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
      expect(screen.getByText('Request Type')).toBeInTheDocument();
    });

    it('should display progress bar', () => {
      renderComponent();
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow', '25');
    });
  });

  describe('Request Type Selection (Step 1)', () => {
    it('should display request type options', () => {
      renderComponent();
      
      expect(screen.getByLabelText(/contract review/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/new contract/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/amendment/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/legal advice/i)).toBeInTheDocument();
    });

    it('should enable next button when type is selected', async () => {
      renderComponent();
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
      
      const contractReviewOption = screen.getByLabelText(/contract review/i);
      fireEvent.click(contractReviewOption);
      
      await waitFor(() => {
        expect(nextButton).toBeEnabled();
      });
    });

    it('should show priority selection for urgent requests', async () => {
      renderComponent();
      
      const contractReviewOption = screen.getByLabelText(/contract review/i);
      fireEvent.click(contractReviewOption);
      
      const urgentToggle = screen.getByLabelText(/urgent request/i);
      fireEvent.click(urgentToggle);
      
      await waitFor(() => {
        expect(screen.getByText(/priority level/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/high priority/i)).toBeInTheDocument();
      });
    });

    it('should proceed to step 2 when next is clicked', async () => {
      renderComponent();
      
      const contractReviewOption = screen.getByLabelText(/contract review/i);
      fireEvent.click(contractReviewOption);
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
        expect(screen.getByText('Request Details')).toBeInTheDocument();
      });
    });
  });

  describe('Request Details (Step 2)', () => {
    beforeEach(async () => {
      renderComponent();
      const contractReviewOption = screen.getByLabelText(/contract review/i);
      fireEvent.click(contractReviewOption);
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      await waitFor(() => screen.getByText('Step 2 of 4'));
    });

    it('should show dynamic form fields based on request type', () => {
      expect(screen.getByLabelText(/request title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/contract value/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/counterparty/i)).toBeInTheDocument();
    });

    it('should show conditional fields based on inputs', async () => {
      const contractValueInput = screen.getByLabelText(/contract value/i);
      await userEvent.type(contractValueInput, '1000000');
      
      await waitFor(() => {
        expect(screen.getByLabelText(/requires cfo approval/i)).toBeInTheDocument();
      });
    });

    it('should validate required fields', async () => {
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
        expect(screen.getByText(/description is required/i)).toBeInTheDocument();
      });
    });

    it('should show industry-specific fields', async () => {
      const industrySelect = screen.getByLabelText(/industry/i);
      fireEvent.change(industrySelect, { target: { value: 'healthcare' } });
      
      await waitFor(() => {
        expect(screen.getByLabelText(/hipaa compliance required/i)).toBeInTheDocument();
      });
    });

    it('should save as draft when save button is clicked', async () => {
      const titleInput = screen.getByLabelText(/request title/i);
      await userEvent.type(titleInput, 'Test Request');
      
      const saveButton = screen.getByRole('button', { name: /save draft/i });
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test Request',
            status: 'draft',
          })
        );
      });
    });
  });

  describe('File Attachments (Step 3)', () => {
    beforeEach(async () => {
      renderComponent();
      // Navigate to step 3
      const contractReviewOption = screen.getByLabelText(/contract review/i);
      fireEvent.click(contractReviewOption);
      let nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      await waitFor(() => screen.getByText('Step 2 of 4'));
      
      const titleInput = screen.getByLabelText(/request title/i);
      await userEvent.type(titleInput, 'Test Request');
      const descInput = screen.getByLabelText(/description/i);
      await userEvent.type(descInput, 'Test Description');
      
      nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      await waitFor(() => screen.getByText('Step 3 of 4'));
    });

    it('should show file upload interface', () => {
      expect(screen.getByText('File Attachments')).toBeInTheDocument();
      expect(screen.getByTestId('file-upload-zone')).toBeInTheDocument();
      expect(screen.getByText(/drag and drop files here/i)).toBeInTheDocument();
    });

    it('should handle file uploads', async () => {
      const file = new File(['test content'], 'contract.pdf', { type: 'application/pdf' });
      const uploadZone = screen.getByTestId('file-upload-zone');
      
      Object.defineProperty(uploadZone, 'files', {
        value: [file],
        configurable: true,
      });
      
      fireEvent.change(uploadZone);
      
      await waitFor(() => {
        expect(screen.getByText('contract.pdf')).toBeInTheDocument();
      });
    });

    it('should validate file types', async () => {
      const invalidFile = new File(['test'], 'test.exe', { type: 'application/exe' });
      const uploadZone = screen.getByTestId('file-upload-zone');
      
      Object.defineProperty(uploadZone, 'files', {
        value: [invalidFile],
        configurable: true,
      });
      
      fireEvent.change(uploadZone);
      
      await waitFor(() => {
        expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
      });
    });

    it('should show upload progress', async () => {
      const file = new File(['test content'], 'contract.pdf', { type: 'application/pdf' });
      const uploadZone = screen.getByTestId('file-upload-zone');
      
      Object.defineProperty(uploadZone, 'files', {
        value: [file],
        configurable: true,
      });
      
      fireEvent.change(uploadZone);
      
      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
    });

    it('should allow file removal', async () => {
      const file = new File(['test content'], 'contract.pdf', { type: 'application/pdf' });
      const uploadZone = screen.getByTestId('file-upload-zone');
      
      Object.defineProperty(uploadZone, 'files', {
        value: [file],
        configurable: true,
      });
      
      fireEvent.change(uploadZone);
      
      await waitFor(() => {
        const removeButton = screen.getByRole('button', { name: /remove contract.pdf/i });
        fireEvent.click(removeButton);
      });
      
      await waitFor(() => {
        expect(screen.queryByText('contract.pdf')).not.toBeInTheDocument();
      });
    });

    it('should proceed to step 4 without files', async () => {
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText('Step 4 of 4')).toBeInTheDocument();
      });
    });
  });

  describe('Review and Submit (Step 4)', () => {
    const navigateToStep4 = async () => {
      renderComponent();
      // Navigate through all steps
      const contractReviewOption = screen.getByLabelText(/contract review/i);
      fireEvent.click(contractReviewOption);
      let nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      await waitFor(() => screen.getByText('Step 2 of 4'));
      
      const titleInput = screen.getByLabelText(/request title/i);
      await userEvent.type(titleInput, 'Test Request');
      const descInput = screen.getByLabelText(/description/i);
      await userEvent.type(descInput, 'Test Description');
      
      nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      await waitFor(() => screen.getByText('Step 3 of 4'));
      
      nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      await waitFor(() => screen.getByText('Step 4 of 4'));
    };

    it('should show request summary', async () => {
      await navigateToStep4();
      
      expect(screen.getByText('Review & Submit')).toBeInTheDocument();
      expect(screen.getByText('Request Summary')).toBeInTheDocument();
      expect(screen.getByText('Test Request')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
    });

    it('should show routing information', async () => {
      await navigateToStep4();
      
      expect(screen.getByText(/assigned to/i)).toBeInTheDocument();
      expect(screen.getByText(/estimated completion/i)).toBeInTheDocument();
      expect(screen.getByText(/priority/i)).toBeInTheDocument();
    });

    it('should allow editing previous steps', async () => {
      await navigateToStep4();
      
      const editDetailsButton = screen.getByRole('button', { name: /edit details/i });
      fireEvent.click(editDetailsButton);
      
      await waitFor(() => {
        expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
      });
    });

    it('should submit request when submit button is clicked', async () => {
      await navigateToStep4();
      
      const submitButton = screen.getByRole('button', { name: /submit request/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test Request',
            description: 'Test Description',
            type: 'contract_review',
            status: 'submitted',
          })
        );
      });
    });

    it('should show confirmation after submission', async () => {
      await navigateToStep4();
      
      const submitButton = screen.getByRole('button', { name: /submit request/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/request submitted successfully/i)).toBeInTheDocument();
        expect(screen.getByText(/request id/i)).toBeInTheDocument();
      });
    });
  });

  describe('Request Routing Rules', () => {
    it('should route high-value contracts to senior lawyers', async () => {
      renderComponent();
      
      const contractReviewOption = screen.getByLabelText(/contract review/i);
      fireEvent.click(contractReviewOption);
      let nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => screen.getByText('Step 2 of 4'));
      
      const contractValueInput = screen.getByLabelText(/contract value/i);
      await userEvent.type(contractValueInput, '5000000');
      
      const titleInput = screen.getByLabelText(/request title/i);
      await userEvent.type(titleInput, 'High Value Contract');
      const descInput = screen.getByLabelText(/description/i);
      await userEvent.type(descInput, 'Large contract review');
      
      nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      await waitFor(() => screen.getByText('Step 3 of 4'));
      
      nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      await waitFor(() => screen.getByText('Step 4 of 4'));
      
      expect(screen.getByText(/senior legal counsel/i)).toBeInTheDocument();
    });

    it('should route urgent requests with shorter SLA', async () => {
      renderComponent();
      
      const contractReviewOption = screen.getByLabelText(/contract review/i);
      fireEvent.click(contractReviewOption);
      
      const urgentToggle = screen.getByLabelText(/urgent request/i);
      fireEvent.click(urgentToggle);
      
      let nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => screen.getByText('Step 2 of 4'));
      
      const titleInput = screen.getByLabelText(/request title/i);
      await userEvent.type(titleInput, 'Urgent Contract');
      const descInput = screen.getByLabelText(/description/i);
      await userEvent.type(descInput, 'Urgent review needed');
      
      nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      await waitFor(() => screen.getByText('Step 3 of 4'));
      
      nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      await waitFor(() => screen.getByText('Step 4 of 4'));
      
      expect(screen.getByText(/24 hours/i)).toBeInTheDocument();
    });
  });

  describe('Template Library Integration', () => {
    it('should show available templates for request type', async () => {
      renderComponent();
      
      const newContractOption = screen.getByLabelText(/new contract/i);
      fireEvent.click(newContractOption);
      
      await waitFor(() => {
        expect(screen.getByText(/use template/i)).toBeInTheDocument();
        expect(screen.getByText(/service agreement/i)).toBeInTheDocument();
        expect(screen.getByText(/nda template/i)).toBeInTheDocument();
      });
    });

    it('should pre-populate fields when template is selected', async () => {
      renderComponent();
      
      const newContractOption = screen.getByLabelText(/new contract/i);
      fireEvent.click(newContractOption);
      
      const templateSelect = screen.getByLabelText(/select template/i);
      fireEvent.change(templateSelect, { target: { value: 'service_agreement' } });
      
      let nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        const titleInput = screen.getByLabelText(/request title/i) as HTMLInputElement;
        expect(titleInput.value).toBe('Service Agreement Review');
      });
    });
  });

  describe('Duplicate Detection', () => {
    it('should warn about similar requests', async () => {
      renderComponent();
      
      const contractReviewOption = screen.getByLabelText(/contract review/i);
      fireEvent.click(contractReviewOption);
      let nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => screen.getByText('Step 2 of 4'));
      
      const titleInput = screen.getByLabelText(/request title/i);
      await userEvent.type(titleInput, 'Acme Corp Contract Review');
      
      await waitFor(() => {
        expect(screen.getByText(/similar request found/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /view similar request/i })).toBeInTheDocument();
      });
    });

    it('should allow proceeding despite duplicates', async () => {
      renderComponent();
      
      const contractReviewOption = screen.getByLabelText(/contract review/i);
      fireEvent.click(contractReviewOption);
      let nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => screen.getByText('Step 2 of 4'));
      
      const titleInput = screen.getByLabelText(/request title/i);
      await userEvent.type(titleInput, 'Acme Corp Contract Review');
      const descInput = screen.getByLabelText(/description/i);
      await userEvent.type(descInput, 'Different contract this time');
      
      const proceedButton = screen.getByRole('button', { name: /proceed anyway/i });
      fireEvent.click(proceedButton);
      
      nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeEnabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Request intake form');
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', 'Form progress');
    });

    it('should support keyboard navigation', () => {
      renderComponent();
      
      const firstOption = screen.getByLabelText(/contract review/i);
      firstOption.focus();
      
      fireEvent.keyDown(firstOption, { key: 'ArrowDown' });
      
      expect(screen.getByLabelText(/new contract/i)).toHaveFocus();
    });

    it('should announce step changes to screen readers', async () => {
      renderComponent();
      
      const contractReviewOption = screen.getByLabelText(/contract review/i);
      fireEvent.click(contractReviewOption);
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/step 2 of 4.*request details/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const { api } = require('../../../services/api');
      api.post.mockRejectedValueOnce(new Error('Network error'));
      
      const component = await navigateToStep4();
      
      const submitButton = screen.getByRole('button', { name: /submit request/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to submit request/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should validate file upload errors', async () => {
      renderComponent();
      
      // Navigate to step 3
      const contractReviewOption = screen.getByLabelText(/contract review/i);
      fireEvent.click(contractReviewOption);
      let nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => screen.getByText('Step 2 of 4'));
      
      const titleInput = screen.getByLabelText(/request title/i);
      await userEvent.type(titleInput, 'Test Request');
      const descInput = screen.getByLabelText(/description/i);
      await userEvent.type(descInput, 'Test Description');
      
      nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      await waitFor(() => screen.getByText('Step 3 of 4'));
      
      // Simulate upload error
      const { api } = require('../../../services/api');
      api.post.mockRejectedValueOnce(new Error('Upload failed'));
      
      const largeFile = new File(['x'.repeat(100 * 1024 * 1024)], 'huge.pdf', { type: 'application/pdf' });
      const uploadZone = screen.getByTestId('file-upload-zone');
      
      Object.defineProperty(uploadZone, 'files', {
        value: [largeFile],
        configurable: true,
      });
      
      fireEvent.change(uploadZone);
      
      await waitFor(() => {
        expect(screen.getByText(/file too large/i)).toBeInTheDocument();
      });
    });
  });
});

// Helper function for navigating to step 4
const navigateToStep4 = async () => {
  const { getByLabelText, getByRole, getByText } = screen;
  
  const contractReviewOption = getByLabelText(/contract review/i);
  fireEvent.click(contractReviewOption);
  let nextButton = getByRole('button', { name: /next/i });
  fireEvent.click(nextButton);
  await waitFor(() => getByText('Step 2 of 4'));
  
  const titleInput = getByLabelText(/request title/i);
  await userEvent.type(titleInput, 'Test Request');
  const descInput = getByLabelText(/description/i);
  await userEvent.type(descInput, 'Test Description');
  
  nextButton = getByRole('button', { name: /next/i });
  fireEvent.click(nextButton);
  await waitFor(() => getByText('Step 3 of 4'));
  
  nextButton = getByRole('button', { name: /next/i });
  fireEvent.click(nextButton);
  await waitFor(() => getByText('Step 4 of 4'));
};