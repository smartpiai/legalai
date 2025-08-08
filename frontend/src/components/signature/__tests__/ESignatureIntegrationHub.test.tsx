import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ESignatureIntegrationHub } from '../ESignatureIntegrationHub';
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
      permissions: ['view_signatures', 'create_signatures', 'manage_signatures'],
    },
  }),
}));

// Mock file operations
global.URL.createObjectURL = vi.fn(() => 'mocked-url');
global.URL.revokeObjectURL = vi.fn();

describe('ESignatureIntegrationHub', () => {
  let queryClient: QueryClient;
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  const mockDocument = {
    id: 'doc1',
    name: 'Service Agreement.pdf',
    size: 2048000,
    mimeType: 'application/pdf',
    url: '/documents/doc1.pdf',
  };

  const mockProviders = [
    {
      id: 'docusign',
      name: 'DocuSign',
      isActive: true,
      isDefault: true,
      capabilities: ['bulk_send', 'templates', 'advanced_routing'],
      status: 'connected',
    },
    {
      id: 'adobe_sign',
      name: 'Adobe Sign',
      isActive: true,
      isDefault: false,
      capabilities: ['bulk_send', 'templates'],
      status: 'connected',
    },
    {
      id: 'hellosign',
      name: 'HelloSign',
      isActive: false,
      isDefault: false,
      capabilities: ['templates'],
      status: 'disconnected',
    },
    {
      id: 'native',
      name: 'Native E-Signature',
      isActive: true,
      isDefault: false,
      capabilities: ['basic_signature'],
      status: 'available',
    },
  ];

  const mockSignatureRequest = {
    id: 'req1',
    documentId: 'doc1',
    title: 'Service Agreement Signature Request',
    status: 'draft',
    provider: 'docusign',
    signers: [
      {
        id: 'signer1',
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'Client',
        order: 1,
        status: 'pending',
        authenticationType: 'email',
        fields: [],
      },
    ],
    settings: {
      expirationDays: 30,
      reminderFrequency: 3,
      allowDecline: true,
      requireSignerOrder: false,
      allowReassign: false,
    },
    createdAt: '2024-01-15T10:00:00Z',
    expiresAt: '2024-02-14T10:00:00Z',
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
      if (url.includes('/signature-providers')) {
        return Promise.resolve({ data: mockProviders });
      }
      if (url.includes('/signature-requests')) {
        return Promise.resolve({ data: [mockSignatureRequest] });
      }
      if (url.includes('/documents')) {
        return Promise.resolve({ data: mockDocument });
      }
      return Promise.resolve({ data: [] });
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ESignatureIntegrationHub
          documentId="doc1"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  describe('Initial Render', () => {
    it('should render the e-signature integration hub', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('signature-integration-hub')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /e-signature integration/i })).toBeInTheDocument();
      });
    });

    it('should show document information', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Service Agreement.pdf')).toBeInTheDocument();
        expect(screen.getByText(/2.0 MB/)).toBeInTheDocument();
      });
    });

    it('should display available providers', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('providers-list')).toBeInTheDocument();
        expect(screen.getByText('DocuSign')).toBeInTheDocument();
        expect(screen.getByText('Adobe Sign')).toBeInTheDocument();
        expect(screen.getByText('Native E-Signature')).toBeInTheDocument();
      });
    });

    it('should highlight default provider', async () => {
      renderComponent();
      
      await waitFor(() => {
        const docusignCard = screen.getByTestId('provider-docusign');
        expect(docusignCard).toHaveClass(/border-blue-500|ring-blue-500/);
        expect(within(docusignCard).getByText('Default')).toBeInTheDocument();
      });
    });
  });

  describe('Provider Selection', () => {
    it('should allow selecting different providers', async () => {
      renderComponent();
      
      await waitFor(() => {
        const adobeCard = screen.getByTestId('provider-adobe_sign');
        fireEvent.click(adobeCard);
      });

      await waitFor(() => {
        expect(screen.getByTestId('provider-adobe_sign')).toHaveClass(/border-blue-500|ring-blue-500/);
      });
    });

    it('should show provider capabilities', async () => {
      renderComponent();
      
      await waitFor(() => {
        const docusignCard = screen.getByTestId('provider-docusign');
        expect(within(docusignCard).getByText('Bulk Send')).toBeInTheDocument();
        expect(within(docusignCard).getByText('Templates')).toBeInTheDocument();
        expect(within(docusignCard).getByText('Advanced Routing')).toBeInTheDocument();
      });
    });

    it('should disable disconnected providers', async () => {
      renderComponent();
      
      await waitFor(() => {
        const hellosignCard = screen.getByTestId('provider-hellosign');
        expect(hellosignCard).toHaveClass('opacity-50');
        expect(within(hellosignCard).getByText('Disconnected')).toBeInTheDocument();
      });
    });

    it('should show provider setup buttons for disconnected providers', async () => {
      renderComponent();
      
      await waitFor(() => {
        const hellosignCard = screen.getByTestId('provider-hellosign');
        expect(within(hellosignCard).getByRole('button', { name: /setup/i })).toBeInTheDocument();
      });
    });
  });

  describe('Signature Packet Assembly', () => {
    it('should show signature packet builder', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('packet-builder')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /signature packet/i })).toBeInTheDocument();
      });
    });

    it('should allow adding signers', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const addSignerButton = screen.getByRole('button', { name: /add signer/i });
        user.click(addSignerButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('signer-form')).toBeInTheDocument();
        expect(screen.getByLabelText(/signer name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/signer email/i)).toBeInTheDocument();
      });
    });

    it('should validate signer information', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const addSignerButton = screen.getByRole('button', { name: /add signer/i });
        user.click(addSignerButton);
      });

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save signer/i });
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });
    });

    it('should show signer list with roles and order', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('signers-list')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Client')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('should allow reordering signers', async () => {
      renderComponent();
      
      await waitFor(() => {
        const signer = screen.getByTestId('signer-signer1');
        const upButton = within(signer).getByRole('button', { name: /move up/i });
        const downButton = within(signer).getByRole('button', { name: /move down/i });
        expect(upButton).toBeInTheDocument();
        expect(downButton).toBeInTheDocument();
      });
    });

    it('should show signer authentication methods', async () => {
      renderComponent();
      
      await waitFor(() => {
        const signer = screen.getByTestId('signer-signer1');
        expect(within(signer).getByText('Email')).toBeInTheDocument();
      });
    });
  });

  describe('Signature Field Placement', () => {
    it('should show signature field editor', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('field-editor')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /signature fields/i })).toBeInTheDocument();
      });
    });

    it('should allow adding signature fields', async () => {
      renderComponent();
      
      await waitFor(() => {
        const addFieldButton = screen.getByRole('button', { name: /add signature field/i });
        fireEvent.click(addFieldButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('field-placement-tools')).toBeInTheDocument();
        expect(screen.getByText(/click to place signature/i)).toBeInTheDocument();
      });
    });

    it('should show different field types', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('field-types')).toBeInTheDocument();
        expect(screen.getByText('Signature')).toBeInTheDocument();
        expect(screen.getByText('Date')).toBeInTheDocument();
        expect(screen.getByText('Text')).toBeInTheDocument();
        expect(screen.getByText('Checkbox')).toBeInTheDocument();
      });
    });

    it('should allow field configuration', async () => {
      renderComponent();
      
      await waitFor(() => {
        const fieldType = screen.getByTestId('field-type-signature');
        fireEvent.click(fieldType);
      });

      await waitFor(() => {
        expect(screen.getByTestId('field-properties')).toBeInTheDocument();
        expect(screen.getByLabelText(/field label/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Signature Routing Logic', () => {
    it('should show routing configuration', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('routing-config')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /routing settings/i })).toBeInTheDocument();
      });
    });

    it('should allow sequential routing', async () => {
      renderComponent();
      
      await waitFor(() => {
        const sequentialOption = screen.getByLabelText(/sequential/i);
        fireEvent.click(sequentialOption);
      });

      await waitFor(() => {
        expect(screen.getByTestId('sequential-order')).toBeInTheDocument();
        expect(screen.getByText(/signers will receive in order/i)).toBeInTheDocument();
      });
    });

    it('should allow parallel routing', async () => {
      renderComponent();
      
      await waitFor(() => {
        const parallelOption = screen.getByLabelText(/parallel/i);
        fireEvent.click(parallelOption);
      });

      await waitFor(() => {
        expect(screen.getByText(/all signers receive simultaneously/i)).toBeInTheDocument();
      });
    });

    it('should show conditional routing options', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('conditional-routing')).toBeInTheDocument();
        expect(screen.getByLabelText(/enable conditional routing/i)).toBeInTheDocument();
      });
    });
  });

  describe('Reminder Automation', () => {
    it('should show reminder settings', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('reminder-settings')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /reminder automation/i })).toBeInTheDocument();
      });
    });

    it('should allow configuring reminder frequency', async () => {
      renderComponent();
      
      await waitFor(() => {
        const frequencySelect = screen.getByLabelText(/reminder frequency/i);
        expect(frequencySelect).toBeInTheDocument();
      });
    });

    it('should show reminder templates', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('reminder-templates')).toBeInTheDocument();
        expect(screen.getByText(/initial reminder/i)).toBeInTheDocument();
        expect(screen.getByText(/follow-up reminder/i)).toBeInTheDocument();
        expect(screen.getByText(/final reminder/i)).toBeInTheDocument();
      });
    });

    it('should allow custom reminder messages', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const customizeButton = screen.getByRole('button', { name: /customize messages/i });
        user.click(customizeButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('message-editor')).toBeInTheDocument();
        expect(screen.getByLabelText(/subject line/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/message body/i)).toBeInTheDocument();
      });
    });
  });

  describe('Bulk Signature Campaigns', () => {
    it('should show bulk campaign interface', async () => {
      renderComponent({ mode: 'bulk' });
      
      await waitFor(() => {
        expect(screen.getByTestId('bulk-campaign')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /bulk signature campaign/i })).toBeInTheDocument();
      });
    });

    it('should allow uploading signer data', async () => {
      renderComponent({ mode: 'bulk' });
      
      await waitFor(() => {
        expect(screen.getByTestId('signer-data-upload')).toBeInTheDocument();
        expect(screen.getByText(/upload csv file/i)).toBeInTheDocument();
      });
    });

    it('should validate signer data format', async () => {
      renderComponent({ mode: 'bulk' });
      
      await waitFor(() => {
        expect(screen.getByTestId('data-validation')).toBeInTheDocument();
        expect(screen.getByText(/required columns/i)).toBeInTheDocument();
      });
    });

    it('should show campaign progress tracking', async () => {
      renderComponent({ mode: 'bulk' });
      
      await waitFor(() => {
        expect(screen.getByTestId('campaign-progress')).toBeInTheDocument();
        expect(screen.getByText(/sent/i)).toBeInTheDocument();
        expect(screen.getByText(/signed/i)).toBeInTheDocument();
        expect(screen.getByText(/pending/i)).toBeInTheDocument();
      });
    });
  });

  describe('Signature Status and Webhooks', () => {
    it('should display signature status dashboard', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('status-dashboard')).toBeInTheDocument();
        expect(screen.getByText(/signature status/i)).toBeInTheDocument();
      });
    });

    it('should show real-time status updates', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('real-time-updates')).toBeInTheDocument();
        expect(screen.getByText('Pending')).toBeInTheDocument();
      });
    });

    it('should show webhook configuration', async () => {
      renderComponent();
      
      await waitFor(() => {
        const webhookButton = screen.getByRole('button', { name: /webhook settings/i });
        fireEvent.click(webhookButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('webhook-config')).toBeInTheDocument();
        expect(screen.getByLabelText(/webhook url/i)).toBeInTheDocument();
      });
    });

    it('should test webhook endpoints', async () => {
      renderComponent();
      
      await waitFor(() => {
        const webhookButton = screen.getByRole('button', { name: /webhook settings/i });
        fireEvent.click(webhookButton);
      });

      await waitFor(() => {
        const testButton = screen.getByRole('button', { name: /test webhook/i });
        fireEvent.click(testButton);
      });

      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'webhook_test',
        })
      );
    });
  });

  describe('Native E-Signature Fallback', () => {
    it('should show native signature interface when selected', async () => {
      renderComponent();
      
      await waitFor(() => {
        const nativeCard = screen.getByTestId('provider-native');
        fireEvent.click(nativeCard);
      });

      await waitFor(() => {
        expect(screen.getByTestId('native-signature-interface')).toBeInTheDocument();
        expect(screen.getByText(/native e-signature/i)).toBeInTheDocument();
      });
    });

    it('should provide basic signature capabilities', async () => {
      renderComponent();
      
      await waitFor(() => {
        const nativeCard = screen.getByTestId('provider-native');
        fireEvent.click(nativeCard);
      });

      await waitFor(() => {
        expect(screen.getByTestId('signature-canvas')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save signature/i })).toBeInTheDocument();
      });
    });

    it('should allow typed signatures', async () => {
      renderComponent();
      
      await waitFor(() => {
        const nativeCard = screen.getByTestId('provider-native');
        fireEvent.click(nativeCard);
      });

      await waitFor(() => {
        const typedTab = screen.getByRole('tab', { name: /typed/i });
        fireEvent.click(typedTab);
      });

      await waitFor(() => {
        expect(screen.getByTestId('typed-signature')).toBeInTheDocument();
        expect(screen.getByLabelText(/type your name/i)).toBeInTheDocument();
      });
    });

    it('should allow uploaded signature images', async () => {
      renderComponent();
      
      await waitFor(() => {
        const nativeCard = screen.getByTestId('provider-native');
        fireEvent.click(nativeCard);
      });

      await waitFor(() => {
        const uploadTab = screen.getByRole('tab', { name: /upload/i });
        fireEvent.click(uploadTab);
      });

      await waitFor(() => {
        expect(screen.getByTestId('signature-upload')).toBeInTheDocument();
        expect(screen.getByText(/choose image file/i)).toBeInTheDocument();
      });
    });
  });

  describe('Signer Authentication Methods', () => {
    it('should show available authentication methods', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('auth-methods')).toBeInTheDocument();
        expect(screen.getByText('Email')).toBeInTheDocument();
        expect(screen.getByText('SMS')).toBeInTheDocument();
        expect(screen.getByText('Knowledge-Based')).toBeInTheDocument();
      });
    });

    it('should configure SMS authentication', async () => {
      renderComponent();
      
      await waitFor(() => {
        const smsOption = screen.getByLabelText(/sms/i);
        fireEvent.click(smsOption);
      });

      await waitFor(() => {
        expect(screen.getByTestId('sms-config')).toBeInTheDocument();
        expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      });
    });

    it('should configure knowledge-based authentication', async () => {
      renderComponent();
      
      await waitFor(() => {
        const kbaOption = screen.getByLabelText(/knowledge-based/i);
        fireEvent.click(kbaOption);
      });

      await waitFor(() => {
        expect(screen.getByTestId('kba-config')).toBeInTheDocument();
        expect(screen.getByText(/identity verification/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle provider API errors', async () => {
      const mockApi = vi.mocked(api);
      mockApi.get.mockRejectedValueOnce(new Error('Provider unavailable'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load providers/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should validate signature request before sending', async () => {
      renderComponent();
      
      await waitFor(() => {
        const sendButton = screen.getByRole('button', { name: /send for signature/i });
        fireEvent.click(sendButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/please add at least one signer/i)).toBeInTheDocument();
      });
    });

    it('should handle missing signature fields', async () => {
      renderComponent();
      
      // Add a signer first
      await waitFor(() => {
        const addSignerButton = screen.getByRole('button', { name: /add signer/i });
        fireEvent.click(addSignerButton);
      });

      await waitFor(() => {
        const sendButton = screen.getByRole('button', { name: /send for signature/i });
        fireEvent.click(sendButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/please add signature fields/i)).toBeInTheDocument();
      });
    });

    it('should show loading states', () => {
      renderComponent();
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText(/loading signature providers/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'E-Signature Integration Hub');
        expect(screen.getByRole('region', { name: /providers/i })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: /signature packet/i })).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const firstProvider = screen.getByTestId('provider-docusign');
        firstProvider.focus();
        
        user.keyboard('{Enter}');
      });

      await waitFor(() => {
        expect(screen.getByTestId('provider-docusign')).toHaveClass(/border-blue-500|ring-blue-500/);
      });
    });

    it('should announce important updates', async () => {
      renderComponent();
      
      await waitFor(() => {
        const sendButton = screen.getByRole('button', { name: /send for signature/i });
        fireEvent.click(sendButton);
      });

      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/signature request validation/i);
      });
    });

    it('should provide screen reader friendly descriptions', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/integration hub for sending documents/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/select signature provider/i)).toBeInTheDocument();
      });
    });
  });

  describe('Integration Flows', () => {
    it('should complete full signature workflow', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Wait for providers to load and select DocuSign
      await waitFor(() => {
        const docusignCard = screen.getByTestId('provider-docusign');
        fireEvent.click(docusignCard);
      });

      // Add a signer
      await waitFor(() => {
        const addSignerButton = screen.getByRole('button', { name: /add signer/i });
        user.click(addSignerButton);
      });

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/signer name/i);
        const emailInput = screen.getByLabelText(/signer email/i);
        user.type(nameInput, 'John Doe');
        user.type(emailInput, 'john@example.com');
        
        const saveButton = screen.getByRole('button', { name: /save signer/i });
        fireEvent.click(saveButton);
      });

      // Add signature field
      await waitFor(() => {
        const addFieldButton = screen.getByRole('button', { name: /add signature field/i });
        fireEvent.click(addFieldButton);
      });

      // Send for signature
      await waitFor(() => {
        const sendButton = screen.getByRole('button', { name: /send for signature/i });
        fireEvent.click(sendButton);
      });

      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'docusign',
          documentId: 'doc1',
          signers: expect.arrayContaining([
            expect.objectContaining({
              name: 'John Doe',
              email: 'john@example.com',
            }),
          ]),
        })
      );
    });

    it('should handle provider switching mid-flow', async () => {
      renderComponent();
      
      // Select DocuSign first
      await waitFor(() => {
        const docusignCard = screen.getByTestId('provider-docusign');
        fireEvent.click(docusignCard);
      });

      // Switch to Adobe Sign
      await waitFor(() => {
        const adobeCard = screen.getByTestId('provider-adobe_sign');
        fireEvent.click(adobeCard);
      });

      await waitFor(() => {
        expect(screen.getByTestId('provider-adobe_sign')).toHaveClass(/border-blue-500|ring-blue-500/);
        expect(screen.getByText(/switched to adobe sign/i)).toBeInTheDocument();
      });
    });
  });
});