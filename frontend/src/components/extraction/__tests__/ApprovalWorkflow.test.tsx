import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ApprovalWorkflow } from '../ApprovalWorkflow';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface ExtractedField {
  id: string;
  name: string;
  type: 'text' | 'date' | 'number' | 'boolean' | 'list' | 'entity';
  value: any;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected' | 'needs_review';
  reviewedBy?: string;
  reviewedAt?: string;
  category: string;
  required: boolean;
}

interface ApprovalStep {
  id: string;
  name: string;
  description: string;
  requiredRole: string;
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completedAt?: string;
  completedBy?: string;
  comments?: string;
  order: number;
}

interface WorkflowInstance {
  id: string;
  extractionResultId: string;
  documentName: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'cancelled';
  currentStep: number;
  steps: ApprovalStep[];
  createdAt: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  submittedBy: string;
  totalFields: number;
  approvedFields: number;
  rejectedFields: number;
  pendingFields: number;
}

interface ApprovalWorkflowProps {
  workflowInstance: WorkflowInstance;
  extractedFields: ExtractedField[];
  currentUser: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
  };
  onApprove?: (stepId: string, comments?: string) => void;
  onReject?: (stepId: string, comments: string) => void;
  onAssignStep?: (stepId: string, userId: string) => void;
  onFieldStatusChange?: (fieldId: string, status: ExtractedField['status'], comments?: string) => void;
  onWorkflowAction?: (action: 'cancel' | 'restart' | 'escalate') => void;
  onSendNotification?: (recipientId: string, message: string) => void;
}

// Mock API
vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('ApprovalWorkflow', () => {
  let queryClient: QueryClient;
  const mockOnApprove = vi.fn();
  const mockOnReject = vi.fn();
  const mockOnAssignStep = vi.fn();
  const mockOnFieldStatusChange = vi.fn();
  const mockOnWorkflowAction = vi.fn();
  const mockOnSendNotification = vi.fn();

  const extractedFields: ExtractedField[] = [
    {
      id: 'f1',
      name: 'Contract Title',
      type: 'text',
      value: 'Software License Agreement',
      confidence: 0.95,
      status: 'approved',
      reviewedBy: 'John Doe',
      reviewedAt: '2024-01-15T10:30:00Z',
      category: 'Basic Information',
      required: true,
    },
    {
      id: 'f2',
      name: 'Effective Date',
      type: 'date',
      value: '2024-01-15',
      confidence: 0.87,
      status: 'pending',
      category: 'Dates',
      required: true,
    },
    {
      id: 'f3',
      name: 'Contract Value',
      type: 'number',
      value: 50000,
      confidence: 0.72,
      status: 'needs_review',
      category: 'Financial',
      required: false,
    },
  ];

  const workflowSteps: ApprovalStep[] = [
    {
      id: 's1',
      name: 'Initial Review',
      description: 'Review extracted data for accuracy',
      requiredRole: 'analyst',
      assignedTo: 'user1',
      status: 'completed',
      completedAt: '2024-01-15T10:30:00Z',
      completedBy: 'John Doe',
      comments: 'Initial review completed',
      order: 1,
    },
    {
      id: 's2',
      name: 'Legal Review',
      description: 'Legal team review of critical fields',
      requiredRole: 'legal',
      assignedTo: 'user2',
      status: 'in_progress',
      order: 2,
    },
    {
      id: 's3',
      name: 'Final Approval',
      description: 'Manager final approval',
      requiredRole: 'manager',
      status: 'pending',
      order: 3,
    },
  ];

  const workflowInstance: WorkflowInstance = {
    id: 'wf1',
    extractionResultId: 'ext1',
    documentName: 'contract.pdf',
    status: 'in_progress',
    currentStep: 2,
    steps: workflowSteps,
    createdAt: '2024-01-15T09:00:00Z',
    dueDate: '2024-01-20T17:00:00Z',
    priority: 'high',
    submittedBy: 'System',
    totalFields: 3,
    approvedFields: 1,
    rejectedFields: 0,
    pendingFields: 2,
  };

  const currentUser = {
    id: 'user2',
    name: 'Jane Smith',
    role: 'legal',
    permissions: ['approve_extractions', 'assign_tasks', 'view_workflow'],
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
      workflowInstance,
      extractedFields,
      currentUser,
      onApprove: mockOnApprove,
      onReject: mockOnReject,
      onAssignStep: mockOnAssignStep,
      onFieldStatusChange: mockOnFieldStatusChange,
      onWorkflowAction: mockOnWorkflowAction,
      onSendNotification: mockOnSendNotification,
      ...props,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <ApprovalWorkflow {...defaultProps} />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render workflow overview', () => {
      renderComponent();
      
      expect(screen.getByText('contract.pdf')).toBeInTheDocument();
      expect(screen.getByText(/in progress/i)).toBeInTheDocument();
      expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();
      expect(screen.getByText(/due.*jan.*20/i)).toBeInTheDocument();
    });

    it('should display workflow priority', () => {
      renderComponent();
      
      expect(screen.getByTestId('priority-indicator')).toHaveClass('high');
      expect(screen.getByText(/high priority/i)).toBeInTheDocument();
    });

    it('should show field statistics', () => {
      renderComponent();
      
      expect(screen.getByText(/1.*approved/i)).toBeInTheDocument();
      expect(screen.getByText(/0.*rejected/i)).toBeInTheDocument();
      expect(screen.getByText(/2.*pending/i)).toBeInTheDocument();
    });

    it('should display workflow steps', () => {
      renderComponent();
      
      expect(screen.getByText('Initial Review')).toBeInTheDocument();
      expect(screen.getByText('Legal Review')).toBeInTheDocument();
      expect(screen.getByText('Final Approval')).toBeInTheDocument();
    });

    it('should highlight current step', () => {
      renderComponent();
      
      const currentStep = screen.getByTestId('step-s2');
      expect(currentStep).toHaveClass('current-step');
    });

    it('should show overdue indicator when past due date', () => {
      const overdueWorkflow = {
        ...workflowInstance,
        dueDate: '2024-01-10T17:00:00Z', // Past date
      };
      
      renderComponent({ workflowInstance: overdueWorkflow });
      
      expect(screen.getByTestId('overdue-indicator')).toBeInTheDocument();
      expect(screen.getByText(/overdue/i)).toBeInTheDocument();
    });
  });

  describe('Step Management', () => {
    it('should allow approving current step', async () => {
      renderComponent();
      
      const approveButton = screen.getByRole('button', { name: /approve step/i });
      await userEvent.click(approveButton);
      
      expect(mockOnApprove).toHaveBeenCalledWith('s2', undefined);
    });

    it('should require comments for rejection', async () => {
      renderComponent();
      
      const rejectButton = screen.getByRole('button', { name: /reject step/i });
      await userEvent.click(rejectButton);
      
      const commentsTextarea = screen.getByRole('textbox', { name: /rejection comments/i });
      expect(commentsTextarea).toBeInTheDocument();
      expect(commentsTextarea).toBeRequired();
    });

    it('should submit rejection with comments', async () => {
      renderComponent();
      
      const rejectButton = screen.getByRole('button', { name: /reject step/i });
      await userEvent.click(rejectButton);
      
      const commentsTextarea = screen.getByRole('textbox', { name: /rejection comments/i });
      await userEvent.type(commentsTextarea, 'Data accuracy concerns');
      
      const submitRejectButton = screen.getByRole('button', { name: /submit rejection/i });
      await userEvent.click(submitRejectButton);
      
      expect(mockOnReject).toHaveBeenCalledWith('s2', 'Data accuracy concerns');
    });

    it('should allow assigning steps to users', async () => {
      renderComponent();
      
      const assignButton = screen.getAllByRole('button', { name: /assign step/i })[2]; // Final step
      await userEvent.click(assignButton);
      
      const userSelect = screen.getByRole('combobox', { name: /assign to user/i });
      await userEvent.selectOptions(userSelect, 'user3');
      
      const confirmAssignButton = screen.getByRole('button', { name: /confirm assignment/i });
      await userEvent.click(confirmAssignButton);
      
      expect(mockOnAssignStep).toHaveBeenCalledWith('s3', 'user3');
    });

    it('should show step history and comments', () => {
      renderComponent();
      
      const completedStep = screen.getByTestId('step-s1');
      expect(completedStep).toHaveTextContent('Initial review completed');
      expect(completedStep).toHaveTextContent('John Doe');
    });

    it('should disable actions for non-current steps', () => {
      renderComponent();
      
      const futureStepActions = screen.getByTestId('step-s3').querySelectorAll('button');
      futureStepActions.forEach(button => {
        if (button.textContent?.includes('Approve') || button.textContent?.includes('Reject')) {
          expect(button).toBeDisabled();
        }
      });
    });
  });

  describe('Field Review', () => {
    it('should display extracted fields with status', () => {
      renderComponent();
      
      expect(screen.getByText('Contract Title')).toBeInTheDocument();
      expect(screen.getByTestId('field-f1-status')).toHaveClass('approved');
      expect(screen.getByTestId('field-f2-status')).toHaveClass('pending');
      expect(screen.getByTestId('field-f3-status')).toHaveClass('needs-review');
    });

    it('should allow changing field status', async () => {
      renderComponent();
      
      const fieldStatusButton = screen.getByTestId('field-f2-actions');
      const approveFieldButton = fieldStatusButton.querySelector('[aria-label="Approve field"]');
      await userEvent.click(approveFieldButton!);
      
      expect(mockOnFieldStatusChange).toHaveBeenCalledWith('f2', 'approved');
    });

    it('should show confidence indicators', () => {
      renderComponent();
      
      const highConfidenceField = screen.getByTestId('field-f1-confidence');
      const lowConfidenceField = screen.getByTestId('field-f3-confidence');
      
      expect(highConfidenceField).toHaveClass('high-confidence');
      expect(lowConfidenceField).toHaveClass('low-confidence');
    });

    it('should filter fields by status', async () => {
      renderComponent();
      
      const statusFilter = screen.getByRole('combobox', { name: /filter by field status/i });
      await userEvent.selectOptions(statusFilter, 'pending');
      
      expect(screen.getByText('Effective Date')).toBeInTheDocument();
      expect(screen.queryByText('Contract Title')).not.toBeInTheDocument();
    });

    it('should highlight required fields', () => {
      renderComponent();
      
      const requiredField = screen.getByTestId('field-f1');
      const optionalField = screen.getByTestId('field-f3');
      
      expect(requiredField).toHaveTextContent('*');
      expect(optionalField).not.toHaveTextContent('*');
    });
  });

  describe('Workflow Actions', () => {
    it('should allow cancelling workflow', async () => {
      renderComponent();
      
      const actionsButton = screen.getByRole('button', { name: /workflow actions/i });
      await userEvent.click(actionsButton);
      
      const cancelButton = screen.getByRole('menuitem', { name: /cancel workflow/i });
      await userEvent.click(cancelButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm cancellation/i });
      await userEvent.click(confirmButton);
      
      expect(mockOnWorkflowAction).toHaveBeenCalledWith('cancel');
    });

    it('should allow restarting workflow', async () => {
      const completedWorkflow = {
        ...workflowInstance,
        status: 'rejected' as const,
      };
      
      renderComponent({ workflowInstance: completedWorkflow });
      
      const actionsButton = screen.getByRole('button', { name: /workflow actions/i });
      await userEvent.click(actionsButton);
      
      const restartButton = screen.getByRole('menuitem', { name: /restart workflow/i });
      await userEvent.click(restartButton);
      
      expect(mockOnWorkflowAction).toHaveBeenCalledWith('restart');
    });

    it('should allow escalating workflow', async () => {
      renderComponent();
      
      const actionsButton = screen.getByRole('button', { name: /workflow actions/i });
      await userEvent.click(actionsButton);
      
      const escalateButton = screen.getByRole('menuitem', { name: /escalate/i });
      await userEvent.click(escalateButton);
      
      expect(mockOnWorkflowAction).toHaveBeenCalledWith('escalate');
    });

    it('should send notifications to assignees', async () => {
      renderComponent();
      
      const notifyButton = screen.getByRole('button', { name: /send notification/i });
      await userEvent.click(notifyButton);
      
      const messageInput = screen.getByRole('textbox', { name: /notification message/i });
      await userEvent.type(messageInput, 'Please review the extraction results');
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      await userEvent.click(sendButton);
      
      expect(mockOnSendNotification).toHaveBeenCalledWith('user2', 'Please review the extraction results');
    });
  });

  describe('Progress Tracking', () => {
    it('should show workflow progress bar', () => {
      renderComponent();
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '66.67'); // Step 2 of 3
    });

    it('should display time remaining until due date', () => {
      renderComponent();
      
      expect(screen.getByTestId('time-remaining')).toBeInTheDocument();
    });

    it('should show field completion percentage', () => {
      renderComponent();
      
      const fieldProgress = screen.getByTestId('field-progress');
      expect(fieldProgress).toHaveTextContent('33%'); // 1 of 3 approved
    });

    it('should calculate estimated completion time', () => {
      renderComponent();
      
      const estimatedCompletion = screen.getByTestId('estimated-completion');
      expect(estimatedCompletion).toBeInTheDocument();
    });
  });

  describe('Permissions', () => {
    it('should hide approve/reject buttons without permission', () => {
      const limitedUser = {
        ...currentUser,
        permissions: ['view_workflow'],
      };
      
      renderComponent({ currentUser: limitedUser });
      
      expect(screen.queryByRole('button', { name: /approve step/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reject step/i })).not.toBeInTheDocument();
    });

    it('should hide assignment controls without permission', () => {
      const limitedUser = {
        ...currentUser,
        permissions: ['approve_extractions'],
      };
      
      renderComponent({ currentUser: limitedUser });
      
      expect(screen.queryByRole('button', { name: /assign step/i })).not.toBeInTheDocument();
    });

    it('should show read-only view for unauthorized users', () => {
      const readOnlyUser = {
        ...currentUser,
        permissions: ['view_workflow'],
      };
      
      renderComponent({ currentUser: readOnlyUser });
      
      expect(screen.getByText(/read-only access/i)).toBeInTheDocument();
    });

    it('should enable actions only for assigned user', () => {
      const unassignedUser = {
        ...currentUser,
        id: 'user3',
        role: 'analyst',
      };
      
      renderComponent({ currentUser: unassignedUser });
      
      const approveButton = screen.queryByRole('button', { name: /approve step/i });
      expect(approveButton).toBeDisabled();
    });
  });

  describe('Comments and History', () => {
    it('should display step comments', () => {
      renderComponent();
      
      const completedStep = screen.getByTestId('step-s1');
      expect(completedStep).toHaveTextContent('Initial review completed');
    });

    it('should allow adding comments to current step', async () => {
      renderComponent();
      
      const addCommentButton = screen.getByRole('button', { name: /add comment/i });
      await userEvent.click(addCommentButton);
      
      const commentInput = screen.getByRole('textbox', { name: /add comment/i });
      await userEvent.type(commentInput, 'Additional review notes');
      
      const saveCommentButton = screen.getByRole('button', { name: /save comment/i });
      await userEvent.click(saveCommentButton);
      
      expect(screen.getByText('Additional review notes')).toBeInTheDocument();
    });

    it('should show audit trail of changes', () => {
      renderComponent();
      
      const auditTrail = screen.getByTestId('audit-trail');
      expect(auditTrail).toBeInTheDocument();
    });

    it('should display step timestamps', () => {
      renderComponent();
      
      const completedStep = screen.getByTestId('step-s1');
      expect(completedStep).toHaveTextContent('Jan 15, 10:30 AM');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('region', { name: /approval workflow/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /workflow steps/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /field review/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      const firstStep = screen.getByTestId('step-s1');
      firstStep.focus();
      
      fireEvent.keyDown(firstStep, { key: 'ArrowDown' });
      const secondStep = screen.getByTestId('step-s2');
      expect(secondStep).toHaveFocus();
    });

    it('should announce workflow status changes', async () => {
      renderComponent();
      
      const approveButton = screen.getByRole('button', { name: /approve step/i });
      await userEvent.click(approveButton);
      
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveTextContent(/step approved/i);
    });

    it('should provide descriptive button labels', () => {
      renderComponent();
      
      const approveButton = screen.getByRole('button', { name: /approve legal review step/i });
      expect(approveButton).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error messages for failed actions', async () => {
      mockOnApprove.mockRejectedValue(new Error('Network error'));
      
      renderComponent();
      
      const approveButton = screen.getByRole('button', { name: /approve step/i });
      await userEvent.click(approveButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to approve step/i)).toBeInTheDocument();
      });
    });

    it('should handle missing workflow data gracefully', () => {
      const incompleteWorkflow = {
        ...workflowInstance,
        steps: [],
      };
      
      renderComponent({ workflowInstance: incompleteWorkflow });
      
      expect(screen.getByText(/no workflow steps defined/i)).toBeInTheDocument();
    });

    it('should validate required comments', async () => {
      renderComponent();
      
      const rejectButton = screen.getByRole('button', { name: /reject step/i });
      await userEvent.click(rejectButton);
      
      const submitRejectButton = screen.getByRole('button', { name: /submit rejection/i });
      await userEvent.click(submitRejectButton);
      
      expect(screen.getByText(/comments required for rejection/i)).toBeInTheDocument();
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
        status: 'pending' as const,
        category: 'Generated',
        required: false,
      }));
      
      renderComponent({ extractedFields: manyFields });
      
      expect(screen.getByText(/1000.*pending/i)).toBeInTheDocument();
    });

    it('should virtualize long field lists', () => {
      const manyFields = Array.from({ length: 1000 }, (_, i) => ({
        id: `f${i}`,
        name: `Field ${i}`,
        type: 'text' as const,
        value: `Value ${i}`,
        confidence: Math.random(),
        status: 'pending' as const,
        category: 'Generated',
        required: false,
      }));
      
      renderComponent({ extractedFields: manyFields });
      
      // Should only render visible fields
      const renderedFields = document.querySelectorAll('[data-testid^="field-"]');
      expect(renderedFields.length).toBeLessThan(100);
    });
  });
});