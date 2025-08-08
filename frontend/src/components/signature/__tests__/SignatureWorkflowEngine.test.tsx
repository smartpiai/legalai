import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { SignatureWorkflowEngine } from '../SignatureWorkflowEngine';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '../../../services/api';

// Mock dependencies
vi.mock('../../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../../../store/auth', () => ({
  useAuthStore: () => ({
    user: {
      id: 'user1',
      name: 'John Doe',
      email: 'john@example.com',
      permissions: ['view_signatures', 'manage_workflows', 'approve_signatures'],
    },
  }),
}));

describe('SignatureWorkflowEngine', () => {
  let queryClient: QueryClient;
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  const mockWorkflow = {
    id: 'workflow1',
    name: 'Standard Contract Approval',
    description: 'Standard workflow for contract approvals',
    type: 'sequential',
    status: 'active',
    steps: [
      {
        id: 'step1',
        name: 'Legal Review',
        order: 1,
        type: 'approval',
        assignedTo: 'role:legal_team',
        required: true,
        status: 'pending',
        completedBy: null,
        completedAt: null,
        deadline: '2024-01-25T17:00:00Z',
      },
      {
        id: 'step2',
        name: 'Executive Approval',
        order: 2,
        type: 'signature',
        assignedTo: 'user:exec1',
        required: true,
        status: 'waiting',
        completedBy: null,
        completedAt: null,
        deadline: '2024-01-28T17:00:00Z',
      },
      {
        id: 'step3',
        name: 'Client Signature',
        order: 3,
        type: 'signature',
        assignedTo: 'external:client@company.com',
        required: true,
        status: 'waiting',
        completedBy: null,
        completedAt: null,
        deadline: '2024-01-30T17:00:00Z',
        notarization: true,
        witnesses: ['witness1@company.com'],
      },
    ],
    document: {
      id: 'doc1',
      name: 'Service Agreement.pdf',
      pages: 12,
      signatures: [
        {
          id: 'sig1',
          type: 'electronic',
          page: 11,
          x: 100,
          y: 200,
          width: 200,
          height: 50,
          assignedTo: 'user:exec1',
          status: 'pending',
        },
        {
          id: 'sig2',
          type: 'wet',
          page: 12,
          x: 100,
          y: 300,
          width: 200,
          height: 50,
          assignedTo: 'external:client@company.com',
          status: 'pending',
          notarization: true,
        },
      ],
    },
    notifications: {
      enabled: true,
      reminderFrequency: 24,
      escalationAfter: 72,
    },
    auditTrail: [
      {
        id: 'audit1',
        timestamp: '2024-01-20T10:00:00Z',
        action: 'workflow_created',
        user: 'user1',
        details: 'Workflow created for Service Agreement',
      },
      {
        id: 'audit2',
        timestamp: '2024-01-20T10:05:00Z',
        action: 'step_assigned',
        user: 'system',
        details: 'Legal Review step assigned to legal_team',
      },
    ],
    createdAt: '2024-01-20T10:00:00Z',
    updatedAt: '2024-01-20T10:05:00Z',
  };

  const mockWorkflowTemplates = [
    {
      id: 'template1',
      name: 'Simple Approval',
      description: 'One-step approval workflow',
      steps: 1,
      category: 'basic',
    },
    {
      id: 'template2',
      name: 'Complex Multi-Party',
      description: 'Multi-party signature workflow with notarization',
      steps: 5,
      category: 'advanced',
    },
  ];

  const mockCertificate = {
    id: 'cert1',
    workflowId: 'workflow1',
    type: 'completion',
    status: 'generated',
    url: '/certificates/cert1.pdf',
    generatedAt: '2024-01-30T18:00:00Z',
    validityPeriod: '2024-01-30T18:00:00Z - 2027-01-30T18:00:00Z',
    signatures: [
      {
        signer: 'user:exec1',
        timestamp: '2024-01-28T14:30:00Z',
        verified: true,
      },
      {
        signer: 'external:client@company.com',
        timestamp: '2024-01-30T16:45:00Z',
        verified: true,
        notarized: true,
      },
    ],
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    const mockApi = vi.mocked(api);
    mockApi.get.mockImplementation((url) => {
      if (url.includes('/workflows') && url.includes('/workflow1')) {
        return Promise.resolve({ data: mockWorkflow });
      }
      if (url.includes('/workflow-templates')) {
        return Promise.resolve({ data: mockWorkflowTemplates });
      }
      if (url.includes('/certificates')) {
        return Promise.resolve({ data: mockCertificate });
      }
      return Promise.resolve({ data: [] });
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <SignatureWorkflowEngine
          workflowId="workflow1"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  describe('Initial Render', () => {
    it('should render the signature workflow engine', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('workflow-engine')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /signature workflow engine/i })).toBeInTheDocument();
      });
    });

    it('should show workflow information', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Standard Contract Approval')).toBeInTheDocument();
        expect(screen.getByText('Standard workflow for contract approvals')).toBeInTheDocument();
        expect(screen.getByText('Sequential')).toBeInTheDocument();
      });
    });

    it('should display workflow status badge', async () => {
      renderComponent();
      
      await waitFor(() => {
        const statusBadge = screen.getByTestId('workflow-status');
        expect(statusBadge).toHaveTextContent('Active');
        expect(statusBadge).toHaveClass(/bg-green-/);
      });
    });

    it('should show document information', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('document-info')).toBeInTheDocument();
        expect(screen.getByText('Service Agreement.pdf')).toBeInTheDocument();
        expect(screen.getByText('12 pages')).toBeInTheDocument();
      });
    });
  });

  describe('Sequential Signature Routing', () => {
    it('should display workflow steps in order', async () => {
      renderComponent();
      
      await waitFor(() => {
        const steps = screen.getAllByTestId(/^step-/);
        expect(steps).toHaveLength(3);
        
        expect(within(steps[0]).getByText('1')).toBeInTheDocument();
        expect(within(steps[0]).getByText('Legal Review')).toBeInTheDocument();
        expect(within(steps[1]).getByText('2')).toBeInTheDocument();
        expect(within(steps[1]).getByText('Executive Approval')).toBeInTheDocument();
        expect(within(steps[2]).getByText('3')).toBeInTheDocument();
        expect(within(steps[2]).getByText('Client Signature')).toBeInTheDocument();
      });
    });

    it('should show current active step', async () => {
      renderComponent();
      
      await waitFor(() => {
        const activeStep = screen.getByTestId('step-step1');
        expect(activeStep).toHaveClass(/ring-blue-500/);
        expect(within(activeStep).getByText('Pending')).toBeInTheDocument();
      });
    });

    it('should show waiting steps as disabled', async () => {
      renderComponent();
      
      await waitFor(() => {
        const waitingStep = screen.getByTestId('step-step2');
        expect(waitingStep).toHaveClass(/opacity-50/);
        expect(within(waitingStep).getByText('Waiting')).toBeInTheDocument();
      });
    });

    it('should allow completing current step', async () => {
      renderComponent();
      
      await waitFor(() => {
        const completeButton = screen.getByTestId('complete-step-step1');
        fireEvent.click(completeButton);
      });

      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          stepId: 'step1',
          action: 'complete',
        })
      );
    });

    it('should show step progress indicator', async () => {
      renderComponent();
      
      await waitFor(() => {
        const progressBar = screen.getByTestId('workflow-progress');
        expect(progressBar).toBeInTheDocument();
        expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
      });
    });
  });

  describe('Parallel Signature Options', () => {
    it('should handle parallel workflow type', async () => {
      renderComponent({ workflowType: 'parallel' });
      
      await waitFor(() => {
        expect(screen.getByTestId('parallel-workflow')).toBeInTheDocument();
        expect(screen.getByText('All steps can be completed simultaneously')).toBeInTheDocument();
      });
    });

    it('should show all steps as active in parallel mode', async () => {
      renderComponent({ workflowType: 'parallel' });
      
      await waitFor(() => {
        const steps = screen.getAllByTestId(/^step-/);
        steps.forEach(step => {
          expect(step).not.toHaveClass(/opacity-50/);
        });
      });
    });

    it('should allow completing any step in parallel mode', async () => {
      renderComponent({ workflowType: 'parallel' });
      
      await waitFor(() => {
        const step2CompleteButton = screen.getByTestId('complete-step-step2');
        expect(step2CompleteButton).not.toBeDisabled();
        
        const step3CompleteButton = screen.getByTestId('complete-step-step3');
        expect(step3CompleteButton).not.toBeDisabled();
      });
    });

    it('should show parallel progress differently', async () => {
      renderComponent({ workflowType: 'parallel' });
      
      await waitFor(() => {
        expect(screen.getByText('0 of 3 completed')).toBeInTheDocument();
        expect(screen.getByTestId('parallel-progress-bar')).toBeInTheDocument();
      });
    });
  });

  describe('Conditional Signature Paths', () => {
    it('should show conditional workflow interface', async () => {
      renderComponent({ workflowType: 'conditional' });
      
      await waitFor(() => {
        expect(screen.getByTestId('conditional-workflow')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /conditional paths/i })).toBeInTheDocument();
      });
    });

    it('should display condition rules', async () => {
      renderComponent({ workflowType: 'conditional' });
      
      await waitFor(() => {
        expect(screen.getByTestId('condition-rules')).toBeInTheDocument();
        expect(screen.getByText(/if value > \$100,000/i)).toBeInTheDocument();
        expect(screen.getByText(/then require CFO approval/i)).toBeInTheDocument();
      });
    });

    it('should allow adding new conditions', async () => {
      const user = userEvent.setup();
      renderComponent({ workflowType: 'conditional' });
      
      await waitFor(() => {
        const addConditionButton = screen.getByRole('button', { name: /add condition/i });
        user.click(addConditionButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('condition-builder')).toBeInTheDocument();
        expect(screen.getByLabelText(/condition field/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/operator/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/value/i)).toBeInTheDocument();
      });
    });

    it('should evaluate conditions dynamically', async () => {
      renderComponent({ 
        workflowType: 'conditional',
        documentMetadata: { value: 150000 }
      });
      
      await waitFor(() => {
        const evaluationResult = screen.getByTestId('condition-evaluation');
        expect(evaluationResult).toHaveTextContent('CFO Approval Required');
        expect(screen.getByTestId('step-cfo-approval')).toBeInTheDocument();
      });
    });
  });

  describe('Wet Signature Tracking', () => {
    it('should identify wet signature requirements', async () => {
      renderComponent();
      
      await waitFor(() => {
        const wetSignatureStep = screen.getByTestId('step-step3');
        expect(within(wetSignatureStep).getByTestId('wet-signature-indicator')).toBeInTheDocument();
        expect(within(wetSignatureStep).getByText('Wet Signature')).toBeInTheDocument();
      });
    });

    it('should show wet signature instructions', async () => {
      renderComponent();
      
      await waitFor(() => {
        const wetSignatureStep = screen.getByTestId('step-step3');
        fireEvent.click(wetSignatureStep);
      });

      await waitFor(() => {
        expect(screen.getByTestId('wet-signature-instructions')).toBeInTheDocument();
        expect(screen.getByText(/print and sign physically/i)).toBeInTheDocument();
        expect(screen.getByText(/scan and upload/i)).toBeInTheDocument();
      });
    });

    it('should allow uploading wet signature proof', async () => {
      renderComponent();
      
      await waitFor(() => {
        const uploadButton = screen.getByRole('button', { name: /upload signed document/i });
        fireEvent.click(uploadButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('wet-signature-upload')).toBeInTheDocument();
        expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
      });
    });

    it('should validate wet signature uploads', async () => {
      renderComponent();
      
      const mockFile = new File(['signed content'], 'signed-document.pdf', {
        type: 'application/pdf',
      });

      await waitFor(() => {
        const fileInput = screen.getByTestId('wet-signature-file-input');
        fireEvent.change(fileInput, { target: { files: [mockFile] } });
      });

      await waitFor(() => {
        expect(screen.getByTestId('signature-validation')).toBeInTheDocument();
        expect(screen.getByText('Validating signature...')).toBeInTheDocument();
      });
    });
  });

  describe('Notarization Support', () => {
    it('should show notarization requirements', async () => {
      renderComponent();
      
      await waitFor(() => {
        const notarizedStep = screen.getByTestId('step-step3');
        expect(within(notarizedStep).getByTestId('notarization-required')).toBeInTheDocument();
        expect(within(notarizedStep).getByText('Notarization Required')).toBeInTheDocument();
      });
    });

    it('should provide notary instructions', async () => {
      renderComponent();
      
      await waitFor(() => {
        const notaryInfo = screen.getByTestId('notary-instructions');
        fireEvent.click(notaryInfo);
      });

      await waitFor(() => {
        expect(screen.getByTestId('notary-details')).toBeInTheDocument();
        expect(screen.getByText(/notary public must witness/i)).toBeInTheDocument();
        expect(screen.getByText(/valid identification required/i)).toBeInTheDocument();
      });
    });

    it('should allow notary information input', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const notaryButton = screen.getByRole('button', { name: /add notary info/i });
        user.click(notaryButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('notary-form')).toBeInTheDocument();
        expect(screen.getByLabelText(/notary name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/notary commission/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/notary expiration/i)).toBeInTheDocument();
      });
    });

    it('should validate notary credentials', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const notaryButton = screen.getByRole('button', { name: /add notary info/i });
        user.click(notaryButton);
      });

      await waitFor(() => {
        const validateButton = screen.getByRole('button', { name: /validate notary/i });
        fireEvent.click(validateButton);
      });

      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'notary_validation',
        })
      );
    });
  });

  describe('Witness Requirements', () => {
    it('should show witness requirements', async () => {
      renderComponent();
      
      await waitFor(() => {
        const witnessStep = screen.getByTestId('step-step3');
        expect(within(witnessStep).getByTestId('witnesses-required')).toBeInTheDocument();
        expect(within(witnessStep).getByText('1 Witness Required')).toBeInTheDocument();
      });
    });

    it('should display witness list', async () => {
      renderComponent();
      
      await waitFor(() => {
        const witnessInfo = screen.getByTestId('witness-info');
        expect(witnessInfo).toBeInTheDocument();
        expect(screen.getByText('witness1@company.com')).toBeInTheDocument();
      });
    });

    it('should allow adding witnesses', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const addWitnessButton = screen.getByRole('button', { name: /add witness/i });
        user.click(addWitnessButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('witness-form')).toBeInTheDocument();
        expect(screen.getByLabelText(/witness name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/witness email/i)).toBeInTheDocument();
      });
    });

    it('should validate witness signatures', async () => {
      renderComponent();
      
      await waitFor(() => {
        const validateWitnessButton = screen.getByRole('button', { name: /validate witness/i });
        fireEvent.click(validateWitnessButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('witness-validation')).toBeInTheDocument();
        expect(screen.getByText('Validating witness signatures...')).toBeInTheDocument();
      });
    });

    it('should send witness notifications', async () => {
      renderComponent();
      
      await waitFor(() => {
        const notifyWitnessButton = screen.getByRole('button', { name: /notify witnesses/i });
        fireEvent.click(notifyWitnessButton);
      });

      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'witness_notification',
          witnesses: ['witness1@company.com'],
        })
      );
    });
  });

  describe('Signature Page Extraction', () => {
    it('should identify signature pages', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('signature-pages')).toBeInTheDocument();
        expect(screen.getByText('Signature Pages: 11, 12')).toBeInTheDocument();
      });
    });

    it('should show signature page preview', async () => {
      renderComponent();
      
      await waitFor(() => {
        const previewButton = screen.getByRole('button', { name: /preview signature pages/i });
        fireEvent.click(previewButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('signature-page-preview')).toBeInTheDocument();
        expect(screen.getByText('Page 11')).toBeInTheDocument();
        expect(screen.getByText('Page 12')).toBeInTheDocument();
      });
    });

    it('should allow signature field positioning', async () => {
      renderComponent();
      
      await waitFor(() => {
        const positionButton = screen.getByRole('button', { name: /position signatures/i });
        fireEvent.click(positionButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('signature-positioning')).toBeInTheDocument();
        expect(screen.getByText('Drag to position signature fields')).toBeInTheDocument();
      });
    });

    it('should extract signature pages as separate document', async () => {
      renderComponent();
      
      await waitFor(() => {
        const extractButton = screen.getByRole('button', { name: /extract signature pages/i });
        fireEvent.click(extractButton);
      });

      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'extract_signature_pages',
          pages: [11, 12],
        })
      );
    });
  });

  describe('Certificate of Completion', () => {
    it('should show certificate generation option', async () => {
      renderComponent({ workflowStatus: 'completed' });
      
      await waitFor(() => {
        expect(screen.getByTestId('certificate-section')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /generate certificate/i })).toBeInTheDocument();
      });
    });

    it('should display certificate preview', async () => {
      renderComponent({ workflowStatus: 'completed' });
      
      await waitFor(() => {
        const previewButton = screen.getByRole('button', { name: /preview certificate/i });
        fireEvent.click(previewButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('certificate-preview')).toBeInTheDocument();
        expect(screen.getByText('Certificate of Completion')).toBeInTheDocument();
      });
    });

    it('should show certificate details', async () => {
      renderComponent({ workflowStatus: 'completed' });
      
      await waitFor(() => {
        const certificate = screen.getByTestId('certificate-info');
        expect(certificate).toBeInTheDocument();
        expect(screen.getByText('Generated: Jan 30, 2024')).toBeInTheDocument();
        expect(screen.getByText(/Valid until: Jan 30, 2027/)).toBeInTheDocument();
      });
    });

    it('should allow certificate download', async () => {
      renderComponent({ workflowStatus: 'completed' });
      
      await waitFor(() => {
        const downloadButton = screen.getByRole('button', { name: /download certificate/i });
        fireEvent.click(downloadButton);
      });

      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'download_certificate',
          url: '/certificates/cert1.pdf',
        })
      );
    });

    it('should verify certificate signatures', async () => {
      renderComponent({ workflowStatus: 'completed' });
      
      await waitFor(() => {
        const verifyButton = screen.getByRole('button', { name: /verify signatures/i });
        fireEvent.click(verifyButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('signature-verification')).toBeInTheDocument();
        expect(screen.getByText('All signatures verified ✓')).toBeInTheDocument();
      });
    });
  });

  describe('Audit Trail Generation', () => {
    it('should display audit trail', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('audit-trail')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /audit trail/i })).toBeInTheDocument();
      });
    });

    it('should show audit events chronologically', async () => {
      renderComponent();
      
      await waitFor(() => {
        const auditEvents = screen.getAllByTestId(/^audit-event-/);
        expect(auditEvents).toHaveLength(2);
        
        expect(within(auditEvents[0]).getByText('Workflow Created')).toBeInTheDocument();
        expect(within(auditEvents[0]).getByText('Jan 20, 2024')).toBeInTheDocument();
        expect(within(auditEvents[1]).getByText('Step Assigned')).toBeInTheDocument();
      });
    });

    it('should filter audit events', async () => {
      renderComponent();
      
      await waitFor(() => {
        const filterSelect = screen.getByLabelText(/filter audit events/i);
        fireEvent.change(filterSelect, { target: { value: 'user_actions' } });
      });

      await waitFor(() => {
        const filteredEvents = screen.getAllByTestId(/^audit-event-/);
        expect(filteredEvents).toHaveLength(1);
      });
    });

    it('should export audit trail', async () => {
      renderComponent();
      
      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /export audit trail/i });
        fireEvent.click(exportButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('export-options')).toBeInTheDocument();
        expect(screen.getByText('PDF')).toBeInTheDocument();
        expect(screen.getByText('CSV')).toBeInTheDocument();
      });
    });

    it('should include timestamp and user information', async () => {
      renderComponent();
      
      await waitFor(() => {
        const auditEvent = screen.getByTestId('audit-event-audit1');
        expect(within(auditEvent).getByText('10:00 AM')).toBeInTheDocument();
        expect(within(auditEvent).getByText('John Doe')).toBeInTheDocument();
      });
    });
  });

  describe('Legal Validity Verification', () => {
    it('should show validity status', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('legal-validity')).toBeInTheDocument();
        expect(screen.getByText('Legal Validity Status')).toBeInTheDocument();
      });
    });

    it('should verify signature compliance', async () => {
      renderComponent();
      
      await waitFor(() => {
        const verifyButton = screen.getByRole('button', { name: /verify compliance/i });
        fireEvent.click(verifyButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('compliance-check')).toBeInTheDocument();
        expect(screen.getByText('E-SIGN Act Compliant ✓')).toBeInTheDocument();
        expect(screen.getByText('UETA Compliant ✓')).toBeInTheDocument();
      });
    });

    it('should show jurisdiction requirements', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('jurisdiction-info')).toBeInTheDocument();
        expect(screen.getByText(/jurisdiction: california/i)).toBeInTheDocument();
        expect(screen.getByText(/wet signature required/i)).toBeInTheDocument();
      });
    });

    it('should validate document integrity', async () => {
      renderComponent();
      
      await waitFor(() => {
        const integrityButton = screen.getByRole('button', { name: /check integrity/i });
        fireEvent.click(integrityButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('integrity-status')).toBeInTheDocument();
        expect(screen.getByText('Document integrity verified')).toBeInTheDocument();
      });
    });

    it('should show legal warnings if any', async () => {
      renderComponent({ hasLegalWarnings: true });
      
      await waitFor(() => {
        expect(screen.getByTestId('legal-warnings')).toBeInTheDocument();
        expect(screen.getByText(/warning: wet signature may be required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Workflow Templates', () => {
    it('should show available templates', async () => {
      renderComponent({ mode: 'create' });
      
      await waitFor(() => {
        expect(screen.getByTestId('workflow-templates')).toBeInTheDocument();
        expect(screen.getByText('Choose Workflow Template')).toBeInTheDocument();
      });
    });

    it('should display template categories', async () => {
      renderComponent({ mode: 'create' });
      
      await waitFor(() => {
        expect(screen.getByTestId('template-categories')).toBeInTheDocument();
        expect(screen.getByText('Basic')).toBeInTheDocument();
        expect(screen.getByText('Advanced')).toBeInTheDocument();
      });
    });

    it('should allow template selection', async () => {
      renderComponent({ mode: 'create' });
      
      await waitFor(() => {
        const template = screen.getByTestId('template-template1');
        fireEvent.click(template);
      });

      await waitFor(() => {
        expect(template).toHaveClass(/ring-blue-500/);
        expect(screen.getByRole('button', { name: /use template/i })).not.toBeDisabled();
      });
    });

    it('should preview template workflow', async () => {
      renderComponent({ mode: 'create' });
      
      await waitFor(() => {
        const previewButton = screen.getByRole('button', { name: /preview template/i });
        fireEvent.click(previewButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('template-preview')).toBeInTheDocument();
        expect(screen.getByText('Template Preview')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle workflow loading errors', async () => {
      const mockApi = vi.mocked(api);
      mockApi.get.mockRejectedValueOnce(new Error('Workflow not found'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load workflow/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should validate step completion requirements', async () => {
      renderComponent();
      
      await waitFor(() => {
        const incompleteCompleteButton = screen.getByTestId('complete-step-step1');
        fireEvent.click(incompleteCompleteButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/please complete all required fields/i)).toBeInTheDocument();
      });
    });

    it('should handle signature validation failures', async () => {
      renderComponent();
      
      const mockApi = vi.mocked(api);
      mockApi.post.mockRejectedValueOnce({
        response: { data: { error: 'Invalid signature format' } }
      });

      await waitFor(() => {
        const uploadButton = screen.getByRole('button', { name: /upload signed document/i });
        fireEvent.click(uploadButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/invalid signature format/i)).toBeInTheDocument();
      });
    });

    it('should show loading states', () => {
      renderComponent();
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText(/loading workflow/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Signature Workflow Engine');
        expect(screen.getByRole('region', { name: /workflow steps/i })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: /audit trail/i })).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const firstStep = screen.getByTestId('step-step1');
        firstStep.focus();
        
        user.keyboard('{Enter}');
      });

      await waitFor(() => {
        expect(screen.getByTestId('step-details-step1')).toBeInTheDocument();
      });
    });

    it('should announce workflow updates', async () => {
      renderComponent();
      
      await waitFor(() => {
        const completeButton = screen.getByTestId('complete-step-step1');
        fireEvent.click(completeButton);
      });

      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/step completed/i);
      });
    });

    it('should provide screen reader friendly descriptions', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/workflow engine for managing signature processes/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/current step: legal review/i)).toBeInTheDocument();
      });
    });
  });

  describe('Integration Features', () => {
    it('should integrate with notification system', async () => {
      renderComponent();
      
      await waitFor(() => {
        const notificationButton = screen.getByRole('button', { name: /notification settings/i });
        fireEvent.click(notificationButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('notification-config')).toBeInTheDocument();
        expect(screen.getByText(/reminder frequency: 24 hours/i)).toBeInTheDocument();
        expect(screen.getByText(/escalation after: 72 hours/i)).toBeInTheDocument();
      });
    });

    it('should complete full workflow cycle', async () => {
      renderComponent();
      
      // Complete all steps
      await waitFor(() => {
        const step1Button = screen.getByTestId('complete-step-step1');
        fireEvent.click(step1Button);
      });

      // Simulate workflow completion
      renderComponent({ workflowStatus: 'completed' });
      
      await waitFor(() => {
        expect(screen.getByTestId('workflow-completed')).toBeInTheDocument();
        expect(screen.getByText('Workflow Completed Successfully')).toBeInTheDocument();
      });

      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: 'workflow1',
          status: 'completed',
        })
      );
    });

    it('should handle workflow cancellation', async () => {
      renderComponent();
      
      await waitFor(() => {
        const cancelButton = screen.getByRole('button', { name: /cancel workflow/i });
        fireEvent.click(cancelButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('cancel-confirmation')).toBeInTheDocument();
        const confirmButton = screen.getByRole('button', { name: /confirm cancellation/i });
        fireEvent.click(confirmButton);
      });

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });
});