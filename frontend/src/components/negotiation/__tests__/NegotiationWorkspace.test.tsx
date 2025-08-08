import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { NegotiationWorkspace } from '../NegotiationWorkspace';
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
      permissions: ['view_negotiations', 'edit_negotiations', 'comment', 'approve'],
    },
  }),
}));

// Mock WebSocket
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// @ts-ignore
global.WebSocket = vi.fn(() => mockWebSocket);

describe('NegotiationWorkspace', () => {
  let queryClient: QueryClient;
  const mockOnSave = vi.fn();
  const mockOnComplete = vi.fn();

  const mockNegotiation = {
    id: 'negotiation1',
    contractId: 'contract1',
    title: 'Service Agreement Negotiation',
    status: 'active',
    participants: [
      {
        id: 'user1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'negotiator',
        party: 'client',
        permissions: ['edit', 'comment', 'approve'],
      },
      {
        id: 'user2',
        name: 'Jane Smith',
        email: 'jane@acme.com',
        role: 'counterparty',
        party: 'vendor',
        permissions: ['edit', 'comment'],
      },
    ],
    positions: [
      {
        id: 'position1',
        clause: 'Payment Terms',
        ourPosition: 'Net 30 payment terms',
        theirPosition: 'Net 15 payment terms',
        status: 'open',
        priority: 'high',
        lastUpdate: '2024-01-20T10:30:00Z',
      },
    ],
    versions: [
      {
        id: 'version1',
        versionNumber: '1.0',
        createdBy: 'user1',
        createdAt: '2024-01-15T09:00:00Z',
        changes: [
          {
            id: 'change1',
            type: 'text_change',
            section: 'Payment Terms',
            oldValue: 'Net 30',
            newValue: 'Net 15',
            author: 'user2',
            timestamp: '2024-01-20T10:30:00Z',
            status: 'pending',
          },
        ],
      },
    ],
    comments: [
      {
        id: 'comment1',
        text: 'We need to discuss this payment term',
        author: 'user1',
        timestamp: '2024-01-20T10:35:00Z',
        section: 'Payment Terms',
        replies: [],
      },
    ],
    analytics: {
      totalChanges: 5,
      pendingChanges: 2,
      acceptedChanges: 3,
      negotiationDuration: '3 days',
      responseTime: '2.5 hours',
    },
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
      if (url.includes('/negotiations')) {
        return Promise.resolve({ data: mockNegotiation });
      }
      if (url.includes('/versions')) {
        return Promise.resolve({ data: mockNegotiation.versions });
      }
      if (url.includes('/comments')) {
        return Promise.resolve({ data: mockNegotiation.comments });
      }
      if (url.includes('/analytics')) {
        return Promise.resolve({ data: mockNegotiation.analytics });
      }
      return Promise.resolve({ data: [] });
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <NegotiationWorkspace
          negotiationId="negotiation1"
          onSave={mockOnSave}
          onComplete={mockOnComplete}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  describe('Initial Render', () => {
    it('should render the negotiation workspace', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('negotiation-workspace')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /negotiation workspace/i })).toBeInTheDocument();
      });
    });

    it('should show negotiation title and status', () => {
      renderComponent();
      
      expect(screen.getByText('Service Agreement Negotiation')).toBeInTheDocument();
      expect(screen.getByTestId('negotiation-status')).toHaveTextContent('Active');
    });

    it('should display participant list', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('participants-list')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('should show negotiation analytics', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/total changes: 5/i)).toBeInTheDocument();
        expect(screen.getByText(/pending changes: 2/i)).toBeInTheDocument();
        expect(screen.getByText(/duration: 3 days/i)).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Collaboration Engine', () => {
    it('should establish WebSocket connection on mount', () => {
      renderComponent();
      
      expect(global.WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('/ws/negotiations/negotiation1')
      );
    });

    it('should show online participants', async () => {
      renderComponent();
      
      // Simulate WebSocket message for user presence
      const wsMessage = {
        type: 'presence_update',
        data: {
          userId: 'user2',
          status: 'online',
          cursorPosition: { section: 'Payment Terms', offset: 45 },
        },
      };

      // Simulate WebSocket message
      const wsCallback = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];
      
      if (wsCallback) {
        wsCallback({ data: JSON.stringify(wsMessage) });
      }

      await waitFor(() => {
        expect(screen.getByTestId('online-indicator-user2')).toBeInTheDocument();
      });
    });

    it('should display user cursors in document', async () => {
      renderComponent();
      
      const wsMessage = {
        type: 'cursor_update',
        data: {
          userId: 'user2',
          userName: 'Jane Smith',
          cursorPosition: { section: 'Payment Terms', offset: 45 },
        },
      };

      const wsCallback = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];
      
      if (wsCallback) {
        wsCallback({ data: JSON.stringify(wsMessage) });
      }

      await waitFor(() => {
        expect(screen.getByTestId('user-cursor-user2')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith is here')).toBeInTheDocument();
      });
    });

    it('should show typing indicators', async () => {
      renderComponent();
      
      const wsMessage = {
        type: 'typing_start',
        data: {
          userId: 'user2',
          userName: 'Jane Smith',
          section: 'Payment Terms',
        },
      };

      const wsCallback = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];
      
      if (wsCallback) {
        wsCallback({ data: JSON.stringify(wsMessage) });
      }

      await waitFor(() => {
        expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
        expect(screen.getByText(/jane smith is typing/i)).toBeInTheDocument();
      });
    });

    it('should sync changes in real-time', async () => {
      renderComponent();
      
      const wsMessage = {
        type: 'change_sync',
        data: {
          changeId: 'change2',
          type: 'text_change',
          section: 'Liability',
          oldValue: '$100,000',
          newValue: '$250,000',
          author: 'user2',
          timestamp: new Date().toISOString(),
        },
      };

      const wsCallback = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];
      
      if (wsCallback) {
        wsCallback({ data: JSON.stringify(wsMessage) });
      }

      await waitFor(() => {
        expect(screen.getByTestId('change-change2')).toBeInTheDocument();
        expect(screen.getByText('$250,000')).toBeInTheDocument();
      });
    });

    it('should handle connection failures gracefully', async () => {
      renderComponent();
      
      // Simulate WebSocket error
      const errorCallback = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];
      
      if (errorCallback) {
        errorCallback(new Event('error'));
      }

      await waitFor(() => {
        expect(screen.getByTestId('connection-error')).toBeInTheDocument();
        expect(screen.getByText(/connection lost/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reconnect/i })).toBeInTheDocument();
      });
    });
  });

  describe('Redline Tracking System', () => {
    it('should display tracked changes', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('redlines-panel')).toBeInTheDocument();
        expect(screen.getByTestId('change-change1')).toBeInTheDocument();
      });
    });

    it('should show change details', async () => {
      renderComponent();
      
      await waitFor(() => {
        const change = screen.getByTestId('change-change1');
        expect(within(change).getByText('Payment Terms')).toBeInTheDocument();
        expect(within(change).getByText('Net 30')).toBeInTheDocument();
        expect(within(change).getByText('Net 15')).toBeInTheDocument();
      });
    });

    it('should allow accepting changes', async () => {
      renderComponent();
      
      await waitFor(() => {
        const acceptButton = screen.getByTestId('accept-change-change1');
        fireEvent.click(acceptButton);
      });

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          changeId: 'change1',
          action: 'accept',
        })
      );
    });

    it('should allow rejecting changes', async () => {
      renderComponent();
      
      await waitFor(() => {
        const rejectButton = screen.getByTestId('reject-change-change1');
        fireEvent.click(rejectButton);
      });

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          changeId: 'change1',
          action: 'reject',
        })
      );
    });

    it('should filter changes by status', async () => {
      renderComponent();
      
      await waitFor(() => {
        const statusFilter = screen.getByLabelText(/filter by status/i);
        fireEvent.change(statusFilter, { target: { value: 'pending' } });
      });

      await waitFor(() => {
        const changes = screen.getAllByTestId(/^change-/);
        changes.forEach(change => {
          expect(change).toHaveAttribute('data-status', 'pending');
        });
      });
    });

    it('should search changes by content', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const searchInput = screen.getByLabelText(/search changes/i);
        user.type(searchInput, 'payment');
      });

      await waitFor(() => {
        expect(screen.getByTestId('change-change1')).toBeInTheDocument();
      });
    });
  });

  describe('Version Comparison Tools', () => {
    it('should show version selector', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('version-selector')).toBeInTheDocument();
        expect(screen.getByText('Version 1.0')).toBeInTheDocument();
      });
    });

    it('should allow comparing versions', async () => {
      renderComponent();
      
      await waitFor(() => {
        const compareButton = screen.getByRole('button', { name: /compare versions/i });
        fireEvent.click(compareButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('version-comparison')).toBeInTheDocument();
        expect(screen.getByText(/side-by-side comparison/i)).toBeInTheDocument();
      });
    });

    it('should highlight differences between versions', async () => {
      renderComponent();
      
      await waitFor(() => {
        const compareButton = screen.getByRole('button', { name: /compare versions/i });
        fireEvent.click(compareButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('diff-added')).toBeInTheDocument();
        expect(screen.getByTestId('diff-removed')).toBeInTheDocument();
        expect(screen.getByTestId('diff-modified')).toBeInTheDocument();
      });
    });

    it('should show version creation details', async () => {
      renderComponent();
      
      await waitFor(() => {
        const versionInfo = screen.getByTestId('version-info');
        expect(within(versionInfo).getByText('Created by John Doe')).toBeInTheDocument();
        expect(within(versionInfo).getByText(/Jan 15, 2024/)).toBeInTheDocument();
      });
    });

    it('should allow restoring previous versions', async () => {
      renderComponent();
      
      await waitFor(() => {
        const restoreButton = screen.getByRole('button', { name: /restore version/i });
        fireEvent.click(restoreButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('restore-confirmation')).toBeInTheDocument();
        expect(screen.getByText(/restore version 1.0/i)).toBeInTheDocument();
      });
    });
  });

  describe('Comment Threading', () => {
    it('should display existing comments', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('comments-panel')).toBeInTheDocument();
        expect(screen.getByTestId('comment-comment1')).toBeInTheDocument();
        expect(screen.getByText('We need to discuss this payment term')).toBeInTheDocument();
      });
    });

    it('should allow adding new comments', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const commentInput = screen.getByLabelText(/add comment/i);
        user.type(commentInput, 'This looks good to me');
        
        const submitButton = screen.getByRole('button', { name: /post comment/i });
        fireEvent.click(submitButton);
      });

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'comment',
          text: 'This looks good to me',
        })
      );
    });

    it('should show comment threads', async () => {
      renderComponent();
      
      await waitFor(() => {
        const comment = screen.getByTestId('comment-comment1');
        const replyButton = within(comment).getByRole('button', { name: /reply/i });
        fireEvent.click(replyButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('reply-form-comment1')).toBeInTheDocument();
        expect(screen.getByLabelText(/reply to comment/i)).toBeInTheDocument();
      });
    });

    it('should mention users in comments', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const commentInput = screen.getByLabelText(/add comment/i);
        user.type(commentInput, '@Jane Smith what do you think?');
      });

      await waitFor(() => {
        expect(screen.getByTestId('mention-jane-smith')).toBeInTheDocument();
      });
    });

    it('should resolve comment threads', async () => {
      renderComponent();
      
      await waitFor(() => {
        const resolveButton = screen.getByTestId('resolve-comment-comment1');
        fireEvent.click(resolveButton);
      });

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          commentId: 'comment1',
          action: 'resolve',
        })
      );
    });

    it('should filter comments by section', async () => {
      renderComponent();
      
      await waitFor(() => {
        const sectionFilter = screen.getByLabelText(/filter by section/i);
        fireEvent.change(sectionFilter, { target: { value: 'Payment Terms' } });
      });

      await waitFor(() => {
        const visibleComments = screen.getAllByTestId(/^comment-/);
        visibleComments.forEach(comment => {
          expect(comment).toHaveAttribute('data-section', 'Payment Terms');
        });
      });
    });
  });

  describe('Change Attribution Tracking', () => {
    it('should show change author information', async () => {
      renderComponent();
      
      await waitFor(() => {
        const change = screen.getByTestId('change-change1');
        expect(within(change).getByText('Changed by Jane Smith')).toBeInTheDocument();
        expect(within(change).getByText(/Jan 20, 2024/)).toBeInTheDocument();
      });
    });

    it('should track change history', async () => {
      renderComponent();
      
      await waitFor(() => {
        const historyButton = screen.getByRole('button', { name: /change history/i });
        fireEvent.click(historyButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('change-history')).toBeInTheDocument();
        expect(screen.getByText(/modification timeline/i)).toBeInTheDocument();
      });
    });

    it('should show user activity indicators', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('user-activity-user1')).toBeInTheDocument();
        expect(screen.getByTestId('user-activity-user2')).toBeInTheDocument();
      });
    });

    it('should display change statistics by user', async () => {
      renderComponent();
      
      await waitFor(() => {
        const statsButton = screen.getByRole('button', { name: /change statistics/i });
        fireEvent.click(statsButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('user-stats')).toBeInTheDocument();
        expect(screen.getByText(/changes by user/i)).toBeInTheDocument();
      });
    });
  });

  describe('Negotiation History Timeline', () => {
    it('should display timeline view', async () => {
      renderComponent();
      
      await waitFor(() => {
        const timelineButton = screen.getByRole('button', { name: /timeline view/i });
        fireEvent.click(timelineButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('negotiation-timeline')).toBeInTheDocument();
        expect(screen.getByText(/negotiation history/i)).toBeInTheDocument();
      });
    });

    it('should show chronological events', async () => {
      renderComponent();
      
      await waitFor(() => {
        const timelineButton = screen.getByRole('button', { name: /timeline view/i });
        fireEvent.click(timelineButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('timeline-event-change1')).toBeInTheDocument();
        expect(screen.getByTestId('timeline-event-comment1')).toBeInTheDocument();
      });
    });

    it('should filter timeline by event type', async () => {
      renderComponent();
      
      await waitFor(() => {
        const timelineButton = screen.getByRole('button', { name: /timeline view/i });
        fireEvent.click(timelineButton);
        
        const eventFilter = screen.getByLabelText(/filter events/i);
        fireEvent.change(eventFilter, { target: { value: 'changes' } });
      });

      await waitFor(() => {
        const events = screen.getAllByTestId(/^timeline-event-/);
        events.forEach(event => {
          expect(event).toHaveAttribute('data-type', 'change');
        });
      });
    });

    it('should show milestone markers', async () => {
      renderComponent();
      
      await waitFor(() => {
        const timelineButton = screen.getByRole('button', { name: /timeline view/i });
        fireEvent.click(timelineButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('milestone-negotiation-start')).toBeInTheDocument();
        expect(screen.getByText(/negotiation started/i)).toBeInTheDocument();
      });
    });
  });

  describe('Position Tracking Matrix', () => {
    it('should display position matrix', async () => {
      renderComponent();
      
      await waitFor(() => {
        const matrixButton = screen.getByRole('button', { name: /position matrix/i });
        fireEvent.click(matrixButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('position-matrix')).toBeInTheDocument();
        expect(screen.getByText(/negotiation positions/i)).toBeInTheDocument();
      });
    });

    it('should show current positions', async () => {
      renderComponent();
      
      await waitFor(() => {
        const matrixButton = screen.getByRole('button', { name: /position matrix/i });
        fireEvent.click(matrixButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('position-position1')).toBeInTheDocument();
        expect(screen.getByText('Net 30 payment terms')).toBeInTheDocument();
        expect(screen.getByText('Net 15 payment terms')).toBeInTheDocument();
      });
    });

    it('should allow updating positions', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const matrixButton = screen.getByRole('button', { name: /position matrix/i });
        fireEvent.click(matrixButton);
        
        const editButton = screen.getByTestId('edit-position-position1');
        fireEvent.click(editButton);
      });

      await waitFor(() => {
        const positionInput = screen.getByLabelText(/our position/i);
        user.clear(positionInput);
        user.type(positionInput, 'Net 45 payment terms');
        
        const saveButton = screen.getByRole('button', { name: /save position/i });
        fireEvent.click(saveButton);
      });

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          positionId: 'position1',
          ourPosition: 'Net 45 payment terms',
        })
      );
    });

    it('should track position history', async () => {
      renderComponent();
      
      await waitFor(() => {
        const matrixButton = screen.getByRole('button', { name: /position matrix/i });
        fireEvent.click(matrixButton);
        
        const historyButton = screen.getByTestId('position-history-position1');
        fireEvent.click(historyButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('position-history')).toBeInTheDocument();
        expect(screen.getByText(/position changes/i)).toBeInTheDocument();
      });
    });

    it('should show position priorities', async () => {
      renderComponent();
      
      await waitFor(() => {
        const matrixButton = screen.getByRole('button', { name: /position matrix/i });
        fireEvent.click(matrixButton);
      });

      await waitFor(() => {
        const position = screen.getByTestId('position-position1');
        expect(within(position).getByTestId('priority-high')).toBeInTheDocument();
      });
    });
  });

  describe('Stakeholder Notification System', () => {
    it('should show notification preferences', async () => {
      renderComponent();
      
      await waitFor(() => {
        const notificationsButton = screen.getByRole('button', { name: /notifications/i });
        fireEvent.click(notificationsButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('notification-preferences')).toBeInTheDocument();
        expect(screen.getByLabelText(/email notifications/i)).toBeInTheDocument();
      });
    });

    it('should send notifications on changes', async () => {
      renderComponent();
      
      // Simulate a change that should trigger notifications
      const wsMessage = {
        type: 'change_sync',
        data: {
          changeId: 'change3',
          type: 'text_change',
          section: 'Termination',
          requiresNotification: true,
        },
      };

      const wsCallback = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];
      
      if (wsCallback) {
        wsCallback({ data: JSON.stringify(wsMessage) });
      }

      await waitFor(() => {
        expect(screen.getByTestId('notification-alert')).toBeInTheDocument();
        expect(screen.getByText(/stakeholders have been notified/i)).toBeInTheDocument();
      });
    });

    it('should show notification history', async () => {
      renderComponent();
      
      await waitFor(() => {
        const notificationsButton = screen.getByRole('button', { name: /notifications/i });
        fireEvent.click(notificationsButton);
        
        const historyTab = screen.getByRole('tab', { name: /notification history/i });
        fireEvent.click(historyTab);
      });

      await waitFor(() => {
        expect(screen.getByTestId('notification-history')).toBeInTheDocument();
      });
    });

    it('should allow configuring notification rules', async () => {
      renderComponent();
      
      await waitFor(() => {
        const notificationsButton = screen.getByRole('button', { name: /notifications/i });
        fireEvent.click(notificationsButton);
        
        const rulesTab = screen.getByRole('tab', { name: /notification rules/i });
        fireEvent.click(rulesTab);
      });

      await waitFor(() => {
        expect(screen.getByTestId('notification-rules')).toBeInTheDocument();
        expect(screen.getByLabelText(/notify on high priority changes/i)).toBeInTheDocument();
      });
    });
  });

  describe('External Party Portal', () => {
    it('should show external access options', async () => {
      renderComponent();
      
      await waitFor(() => {
        const externalButton = screen.getByRole('button', { name: /external access/i });
        fireEvent.click(externalButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('external-portal')).toBeInTheDocument();
        expect(screen.getByText(/share with external parties/i)).toBeInTheDocument();
      });
    });

    it('should generate secure access links', async () => {
      renderComponent();
      
      await waitFor(() => {
        const externalButton = screen.getByRole('button', { name: /external access/i });
        fireEvent.click(externalButton);
        
        const generateButton = screen.getByRole('button', { name: /generate link/i });
        fireEvent.click(generateButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('access-link')).toBeInTheDocument();
        expect(screen.getByText(/secure link generated/i)).toBeInTheDocument();
      });
    });

    it('should show external party permissions', async () => {
      renderComponent();
      
      await waitFor(() => {
        const externalButton = screen.getByRole('button', { name: /external access/i });
        fireEvent.click(externalButton);
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/view only/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/comment only/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/edit access/i)).toBeInTheDocument();
      });
    });

    it('should track external party activity', async () => {
      renderComponent();
      
      await waitFor(() => {
        const externalButton = screen.getByRole('button', { name: /external access/i });
        fireEvent.click(externalButton);
        
        const activityTab = screen.getByRole('tab', { name: /external activity/i });
        fireEvent.click(activityTab);
      });

      await waitFor(() => {
        expect(screen.getByTestId('external-activity')).toBeInTheDocument();
      });
    });
  });

  describe('Negotiation Analytics', () => {
    it('should display analytics dashboard', async () => {
      renderComponent();
      
      await waitFor(() => {
        const analyticsButton = screen.getByRole('button', { name: /analytics/i });
        fireEvent.click(analyticsButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
        expect(screen.getByText(/negotiation metrics/i)).toBeInTheDocument();
      });
    });

    it('should show response time metrics', async () => {
      renderComponent();
      
      await waitFor(() => {
        const analyticsButton = screen.getByRole('button', { name: /analytics/i });
        fireEvent.click(analyticsButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/average response time: 2.5 hours/i)).toBeInTheDocument();
      });
    });

    it('should display change acceptance rates', async () => {
      renderComponent();
      
      await waitFor(() => {
        const analyticsButton = screen.getByRole('button', { name: /analytics/i });
        fireEvent.click(analyticsButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('acceptance-rate-chart')).toBeInTheDocument();
        expect(screen.getByText(/60% acceptance rate/i)).toBeInTheDocument();
      });
    });

    it('should show negotiation progress', async () => {
      renderComponent();
      
      await waitFor(() => {
        const analyticsButton = screen.getByRole('button', { name: /analytics/i });
        fireEvent.click(analyticsButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('progress-indicator')).toBeInTheDocument();
        expect(screen.getByText(/60% complete/i)).toBeInTheDocument();
      });
    });

    it('should provide export functionality', async () => {
      renderComponent();
      
      await waitFor(() => {
        const analyticsButton = screen.getByRole('button', { name: /analytics/i });
        fireEvent.click(analyticsButton);
        
        const exportButton = screen.getByRole('button', { name: /export report/i });
        fireEvent.click(exportButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('export-options')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Negotiation workspace');
      expect(screen.getByRole('region', { name: /participants/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /changes/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const firstChange = screen.getByTestId('change-change1');
        firstChange.focus();
        
        user.keyboard('{Enter}');
      });

      await waitFor(() => {
        expect(screen.getByTestId('change-details-change1')).toBeInTheDocument();
      });
    });

    it('should announce important updates', async () => {
      renderComponent();
      
      // Simulate real-time change
      const wsMessage = {
        type: 'change_sync',
        data: {
          changeId: 'change4',
          type: 'text_change',
          section: 'Liability',
          author: 'user2',
        },
      };

      const wsCallback = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];
      
      if (wsCallback) {
        wsCallback({ data: JSON.stringify(wsMessage) });
      }

      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/new change in liability section/i);
      });
    });

    it('should provide screen reader friendly descriptions', () => {
      renderComponent();
      
      expect(screen.getByText('Negotiation workspace for Service Agreement Negotiation')).toBeInTheDocument();
      expect(screen.getByLabelText(/negotiation status: active/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const mockApi = vi.mocked(api);
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load negotiation/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should show loading states', () => {
      renderComponent();
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText(/loading negotiation/i)).toBeInTheDocument();
    });

    it('should handle save conflicts', async () => {
      const mockApi = vi.mocked(api);
      mockApi.post.mockRejectedValueOnce({ 
        response: { data: { error: 'Negotiation was modified by another user' } }
      });
      
      renderComponent();
      
      await waitFor(() => {
        const acceptButton = screen.getByTestId('accept-change-change1');
        fireEvent.click(acceptButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/negotiation was modified by another user/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
      });
    });

    it('should validate user permissions', async () => {
      const restrictedProps = {
        userPermissions: ['view_negotiations'], // No edit permission
      };
      
      renderComponent(restrictedProps);
      
      await waitFor(() => {
        expect(screen.queryByTestId('accept-change-change1')).not.toBeInTheDocument();
        expect(screen.getByText(/view-only access/i)).toBeInTheDocument();
      });
    });
  });
});