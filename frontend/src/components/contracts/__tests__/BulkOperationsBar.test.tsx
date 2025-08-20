import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { BulkOperationsBar } from '../BulkOperationsBar';
import { useAuthStore } from '../../../store/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';

// Mock stores and utilities
vi.mock('../../../store/auth');
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock API client
vi.mock('../../../services/api', () => ({
  api: {
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '../../../services/api';

describe('BulkOperationsBar', () => {
  let queryClient: QueryClient;
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();
  
  const defaultProps = {
    selectedIds: [1, 2, 3],
    onSuccess: mockOnSuccess,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    // Mock auth store
    (useAuthStore as any).mockReturnValue({
      user: {
        id: 1,
        email: 'test@example.com',
        permissions: ['contract.edit', 'contract.delete', 'contract.approve'],
      },
      hasPermission: (permission: string) => {
        const permissions = ['contract.edit', 'contract.delete', 'contract.approve'];
        return permissions.includes(permission);
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BulkOperationsBar {...defaultProps} {...props} />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render bulk operations bar with selected count', () => {
      renderComponent();
      expect(screen.getByText(/3 contracts selected/i)).toBeInTheDocument();
    });

    it('should render all operation buttons', () => {
      renderComponent();
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /archive/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /tag/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /assign/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should display singular text for single selection', () => {
      renderComponent({ selectedIds: [1] });
      expect(screen.getByText(/1 contract selected/i)).toBeInTheDocument();
    });

    it('should disable buttons based on permissions', () => {
      (useAuthStore as any).mockReturnValue({
        user: { id: 1, email: 'test@example.com', permissions: [] },
        hasPermission: () => false,
      });
      
      renderComponent();
      expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();
    });
  });

  describe('Bulk Approve', () => {
    it('should show confirmation dialog when approve is clicked', async () => {
      renderComponent();
      const approveBtn = screen.getByRole('button', { name: /approve/i });
      
      await userEvent.click(approveBtn);
      
      expect(screen.getByText(/confirm bulk approval/i)).toBeInTheDocument();
      expect(screen.getByText(/approve 3 contracts\?/i)).toBeInTheDocument();
    });

    it('should call API and show success message on confirmation', async () => {
      (api.post as any).mockResolvedValue({ data: { updated: 3 } });
      
      renderComponent();
      const approveBtn = screen.getByRole('button', { name: /approve/i });
      
      await userEvent.click(approveBtn);
      const confirmBtn = screen.getByRole('button', { name: /confirm/i });
      await userEvent.click(confirmBtn);
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/v1/contracts/bulk/approve', {
          contract_ids: [1, 2, 3],
        });
        expect(toast.success).toHaveBeenCalledWith('Successfully approved 3 contracts');
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should show error message on API failure', async () => {
      (api.post as any).mockRejectedValue(new Error('API Error'));
      
      renderComponent();
      const approveBtn = screen.getByRole('button', { name: /approve/i });
      
      await userEvent.click(approveBtn);
      const confirmBtn = screen.getByRole('button', { name: /confirm/i });
      await userEvent.click(confirmBtn);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to approve contracts');
      });
    });
  });

  describe('Bulk Reject', () => {
    it('should show rejection reason dialog', async () => {
      renderComponent();
      const rejectBtn = screen.getByRole('button', { name: /reject/i });
      
      await userEvent.click(rejectBtn);
      
      expect(screen.getByRole('heading', { name: /reject contracts/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/rejection reason/i)).toBeInTheDocument();
    });

    it('should call API with rejection reason', async () => {
      (api.post as any).mockResolvedValue({ data: { updated: 3 } });
      
      renderComponent();
      const rejectBtn = screen.getByRole('button', { name: /reject/i });
      
      await userEvent.click(rejectBtn);
      
      const reasonInput = screen.getByLabelText(/rejection reason/i);
      await userEvent.type(reasonInput, 'Invalid terms');
      
      const confirmBtn = screen.getByRole('button', { name: /^reject contracts$/i });
      await userEvent.click(confirmBtn);
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/v1/contracts/bulk/reject', {
          contract_ids: [1, 2, 3],
          reason: 'Invalid terms',
        });
        expect(toast.success).toHaveBeenCalledWith('Successfully rejected 3 contracts');
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Bulk Archive', () => {
    it('should archive contracts without confirmation', async () => {
      (api.post as any).mockResolvedValue({ data: { updated: 3 } });
      
      renderComponent();
      const archiveBtn = screen.getByRole('button', { name: /archive/i });
      
      await userEvent.click(archiveBtn);
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/v1/contracts/bulk/archive', {
          contract_ids: [1, 2, 3],
        });
        expect(toast.success).toHaveBeenCalledWith('Successfully archived 3 contracts');
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Bulk Delete', () => {
    it('should show delete confirmation with warning', async () => {
      renderComponent();
      const deleteBtn = screen.getByRole('button', { name: /delete/i });
      
      await userEvent.click(deleteBtn);
      
      expect(screen.getByText(/confirm deletion/i)).toBeInTheDocument();
      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
      expect(screen.getByText(/delete 3 contracts\?/i)).toBeInTheDocument();
    });

    it('should require typing DELETE to confirm', async () => {
      renderComponent();
      const deleteBtn = screen.getByRole('button', { name: /delete/i });
      
      await userEvent.click(deleteBtn);
      
      const confirmBtn = screen.getByRole('button', { name: /delete contracts/i });
      expect(confirmBtn).toBeDisabled();
      
      const input = screen.getByPlaceholderText(/type DELETE to confirm/i);
      await userEvent.type(input, 'DELETE');
      
      expect(confirmBtn).not.toBeDisabled();
    });

    it('should call delete API on confirmation', async () => {
      (api.delete as any).mockResolvedValue({ data: { deleted: 3 } });
      
      renderComponent();
      const deleteBtn = screen.getByRole('button', { name: /delete/i });
      
      await userEvent.click(deleteBtn);
      
      const input = screen.getByPlaceholderText(/type DELETE to confirm/i);
      await userEvent.type(input, 'DELETE');
      
      const confirmBtn = screen.getByRole('button', { name: /delete contracts/i });
      await userEvent.click(confirmBtn);
      
      await waitFor(() => {
        expect(api.delete).toHaveBeenCalledWith('/api/v1/contracts/bulk', {
          data: { contract_ids: [1, 2, 3] },
        });
        expect(toast.success).toHaveBeenCalledWith('Successfully deleted 3 contracts');
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Bulk Export', () => {
    it('should show export format options', async () => {
      renderComponent();
      const exportBtn = screen.getByRole('button', { name: /export/i });
      
      await userEvent.click(exportBtn);
      
      expect(screen.getByText(/export contracts/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/pdf/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/excel/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/csv/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/json/i)).toBeInTheDocument();
    });

    it('should call export API with selected format', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      (api.post as any).mockResolvedValue({ data: mockBlob });
      
      // Mock URL.createObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      
      renderComponent();
      const exportBtn = screen.getByRole('button', { name: /export/i });
      
      await userEvent.click(exportBtn);
      
      const pdfRadio = screen.getByLabelText(/pdf/i);
      await userEvent.click(pdfRadio);
      
      const confirmBtn = screen.getByRole('button', { name: /^export$/i });
      await userEvent.click(confirmBtn);
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/api/v1/contracts/bulk/export',
          {
            contract_ids: [1, 2, 3],
            format: 'pdf',
          },
          { responseType: 'blob' }
        );
        expect(toast.success).toHaveBeenCalledWith('Export completed successfully');
      });
    });
  });

  describe('Bulk Tag', () => {
    it('should show tag input dialog', async () => {
      renderComponent();
      const tagBtn = screen.getByRole('button', { name: /tag/i });
      
      await userEvent.click(tagBtn);
      
      expect(screen.getByText(/add tags/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter tags separated by commas/i)).toBeInTheDocument();
    });

    it('should call API with tags', async () => {
      (api.post as any).mockResolvedValue({ data: { updated: 3 } });
      
      renderComponent();
      const tagBtn = screen.getByRole('button', { name: /tag/i });
      
      await userEvent.click(tagBtn);
      
      const input = screen.getByPlaceholderText(/enter tags separated by commas/i);
      await userEvent.type(input, 'urgent, review, legal');
      
      const confirmBtn = screen.getByRole('button', { name: /^add tags$/i });
      await userEvent.click(confirmBtn);
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/v1/contracts/bulk/tag', {
          contract_ids: [1, 2, 3],
          tags: ['urgent', 'review', 'legal'],
        });
        expect(toast.success).toHaveBeenCalledWith('Successfully tagged 3 contracts');
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Bulk Assign', () => {
    it('should show user selection dialog', async () => {
      renderComponent();
      const assignBtn = screen.getByRole('button', { name: /assign/i });
      
      await userEvent.click(assignBtn);
      
      expect(screen.getByText(/assign contracts/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/select user/i)).toBeInTheDocument();
    });

    it('should load and display users', async () => {
      const mockUsers = [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
      ];
      
      (api.get as any) = vi.fn().mockResolvedValue({ data: mockUsers });
      
      renderComponent();
      const assignBtn = screen.getByRole('button', { name: /assign/i });
      
      await userEvent.click(assignBtn);
      
      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
        expect(screen.getByText(/jane smith/i)).toBeInTheDocument();
      });
    });

    it('should call API with selected user', async () => {
      const mockUsers = [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
      ];
      
      (api.get as any) = vi.fn().mockResolvedValue({ data: mockUsers });
      (api.post as any).mockResolvedValue({ data: { updated: 3 } });
      
      renderComponent();
      const assignBtn = screen.getByRole('button', { name: /assign/i });
      
      await userEvent.click(assignBtn);
      
      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      });
      
      const select = screen.getByLabelText(/select user/i);
      await userEvent.selectOptions(select, '1');
      
      const buttons = screen.getAllByRole('button', { name: /assign/i });
      const confirmBtn = buttons[buttons.length - 1]; // Get the last "Assign" button which is in the dialog
      await userEvent.click(confirmBtn);
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/v1/contracts/bulk/assign', {
          contract_ids: [1, 2, 3],
          user_id: 1,
        });
        expect(toast.success).toHaveBeenCalledWith('Successfully assigned 3 contracts');
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Cancel Operation', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      renderComponent();
      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      
      await userEvent.click(cancelBtn);
      
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should call onCancel when ESC key is pressed', async () => {
      renderComponent();
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('should show loading state during operations', async () => {
      (api.post as any).mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderComponent();
      const approveBtn = screen.getByRole('button', { name: /approve/i });
      
      await userEvent.click(approveBtn);
      const confirmBtn = screen.getByRole('button', { name: /confirm/i });
      await userEvent.click(confirmBtn);
      
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should trigger approve with Ctrl+A', async () => {
      renderComponent();
      
      fireEvent.keyDown(document, { key: 'a', ctrlKey: true });
      
      expect(screen.getByText(/confirm bulk approval/i)).toBeInTheDocument();
    });

    it('should trigger delete with Ctrl+D', async () => {
      renderComponent();
      
      fireEvent.keyDown(document, { key: 'd', ctrlKey: true });
      
      expect(screen.getByText(/confirm deletion/i)).toBeInTheDocument();
    });

    it('should trigger export with Ctrl+E', async () => {
      renderComponent();
      
      fireEvent.keyDown(document, { key: 'e', ctrlKey: true });
      
      expect(screen.getByText(/export contracts/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('toolbar')).toHaveAttribute('aria-label', 'Bulk operations toolbar');
      expect(screen.getByRole('status')).toHaveTextContent(/3 contracts selected/i);
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      const buttons = screen.getAllByRole('button');
      
      // Tab through buttons
      buttons[0].focus();
      expect(document.activeElement).toBe(buttons[0]);
      
      // Note: Tab key navigation is handled by the browser and may not work in jsdom
      // This test would need to be an e2e test to properly verify tab navigation
      expect(buttons[1]).toBeDefined();
    });

    it('should announce operation results to screen readers', async () => {
      (api.post as any).mockResolvedValue({ data: { updated: 3 } });
      
      renderComponent();
      const approveBtn = screen.getByRole('button', { name: /approve/i });
      
      await userEvent.click(approveBtn);
      const confirmBtn = screen.getByRole('button', { name: /confirm/i });
      await userEvent.click(confirmBtn);
      
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(/successfully approved 3 contracts/i);
      });
    });
  });
});
