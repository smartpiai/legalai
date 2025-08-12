import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CollaborationPlatformService } from '../collaboration-platform.service';
import {
  TeamsConfig,
  SlackConfig,
  SharePointConfig,
  PlatformType,
  PresenceStatus,
  MessagePriority,
  FileType,
  NotificationType,
  ActivityType,
  IntegrationStatus,
  CollaborationError,
  ErrorCode
} from '../../types/collaboration.types';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock WebSocket
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: WebSocket.OPEN
};
global.WebSocket = vi.fn(() => mockWebSocket) as any;

// Mock Microsoft Graph SDK
vi.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    init: vi.fn(() => ({
      api: vi.fn().mockReturnThis(),
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    }))
  }
}));

// Mock Slack SDK
vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn(() => ({
    chat: { postMessage: vi.fn() },
    conversations: { list: vi.fn(), create: vi.fn() },
    files: { upload: vi.fn() },
    users: { list: vi.fn(), getPresence: vi.fn() }
  }))
}));

describe('CollaborationPlatformService', () => {
  let service: CollaborationPlatformService;
  const mockTenantId = 'tenant-123';

  const mockTeamsConfig: TeamsConfig = {
    clientId: 'teams-client-id',
    tenantId: 'teams-tenant-id',
    scope: ['https://graph.microsoft.com/.default'],
    redirectUri: 'https://app.example.com/auth/teams',
    appId: 'teams-app-id'
  };

  const mockSlackConfig: SlackConfig = {
    clientId: 'slack-client-id',
    clientSecret: 'slack-client-secret',
    scope: ['chat:write', 'channels:read'],
    redirectUri: 'https://app.example.com/auth/slack',
    botToken: 'xoxb-slack-bot-token'
  };

  const mockSharePointConfig: SharePointConfig = {
    siteUrl: 'https://tenant.sharepoint.com',
    clientId: 'sharepoint-client-id',
    tenantId: 'sharepoint-tenant-id',
    scope: ['https://graph.microsoft.com/.default']
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CollaborationPlatformService(mockTenantId);
  });

  afterEach(() => {
    service.destroy();
  });

  describe('Initialization and Configuration', () => {
    it('should initialize service with tenant ID', () => {
      expect(service.getTenantId()).toBe(mockTenantId);
      expect(service.getStatus()).toBe(IntegrationStatus.DISCONNECTED);
    });

    it('should configure Teams integration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'teams-token' })
      });

      await service.configureTeams(mockTeamsConfig);
      
      expect(service.getIntegratedPlatforms()).toContain(PlatformType.TEAMS);
      expect(service.getStatus()).toBe(IntegrationStatus.CONNECTED);
    });

    it('should configure Slack integration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'slack-token' })
      });

      await service.configureSlack(mockSlackConfig);
      
      expect(service.getIntegratedPlatforms()).toContain(PlatformType.SLACK);
      expect(service.getStatus()).toBe(IntegrationStatus.CONNECTED);
    });

    it('should configure SharePoint integration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'sharepoint-token' })
      });

      await service.configureSharePoint(mockSharePointConfig);
      
      expect(service.getIntegratedPlatforms()).toContain(PlatformType.SHAREPOINT);
      expect(service.getStatus()).toBe(IntegrationStatus.CONNECTED);
    });

    it('should handle authentication errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' })
      });

      await expect(service.configureTeams(mockTeamsConfig))
        .rejects.toThrow(CollaborationError);
    });

    it('should validate configuration before setup', async () => {
      const invalidConfig = { ...mockTeamsConfig, clientId: '' };
      
      await expect(service.configureTeams(invalidConfig))
        .rejects.toThrow('Invalid Teams configuration');
    });
  });

  describe('Microsoft Teams Integration', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'teams-token' })
      });
      await service.configureTeams(mockTeamsConfig);
    });

    it('should embed Teams app in container', async () => {
      const container = document.createElement('div');
      container.id = 'teams-container';
      document.body.appendChild(container);

      const result = await service.embedTeamsApp('teams-container', {
        appId: mockTeamsConfig.appId,
        entityId: 'entity-123',
        contentUrl: 'https://app.example.com/teams-tab'
      });

      expect(result.success).toBe(true);
      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should create Teams channel', async () => {
      const channelData = {
        displayName: 'Legal Review Channel',
        description: 'Channel for contract reviews',
        membershipType: 'standard' as const
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'channel-123',
          displayName: channelData.displayName
        })
      });

      const result = await service.createTeamsChannel('team-123', channelData);
      
      expect(result.id).toBe('channel-123');
      expect(result.displayName).toBe(channelData.displayName);
    });

    it('should schedule Teams meeting', async () => {
      const meetingData = {
        subject: 'Contract Review Meeting',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        attendees: ['user1@example.com', 'user2@example.com']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'meeting-123',
          joinUrl: 'https://teams.microsoft.com/l/meetup-join/...'
        })
      });

      const result = await service.scheduleTeamsMeeting(meetingData);
      
      expect(result.id).toBe('meeting-123');
      expect(result.joinUrl).toContain('teams.microsoft.com');
    });

    it('should handle Teams file sharing', async () => {
      const file = new File(['test content'], 'contract.pdf', { type: 'application/pdf' });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'file-123',
          name: 'contract.pdf',
          downloadUrl: 'https://sharepoint.com/download/file-123'
        })
      });

      const result = await service.shareFileToTeams('channel-123', file, {
        message: 'Please review this contract'
      });
      
      expect(result.fileId).toBe('file-123');
      expect(result.shared).toBe(true);
    });

    it('should send Teams notifications', async () => {
      const notification = {
        type: NotificationType.TASK_ASSIGNED,
        title: 'New Contract Review',
        message: 'You have been assigned a new contract to review',
        priority: MessagePriority.HIGH,
        recipients: ['user1@example.com']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messageId: 'msg-123' })
      });

      const result = await service.sendTeamsNotification(notification);
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
    });

    it('should detect user presence in Teams', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          availability: 'Available',
          activity: 'Available'
        })
      });

      const presence = await service.getTeamsPresence('user1@example.com');
      
      expect(presence.status).toBe(PresenceStatus.AVAILABLE);
      expect(presence.lastSeen).toBeDefined();
    });
  });

  describe('Slack Integration', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'slack-token' })
      });
      await service.configureSlack(mockSlackConfig);
    });

    it('should create Slack workflow', async () => {
      const workflowData = {
        name: 'Contract Approval Workflow',
        description: 'Automated contract approval process',
        triggers: ['contract_uploaded'],
        steps: [
          { type: 'notification', channel: '#legal' },
          { type: 'approval_request', approvers: ['@manager'] }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          workflow: { id: 'workflow-123', name: workflowData.name }
        })
      });

      const result = await service.createSlackWorkflow(workflowData);
      
      expect(result.id).toBe('workflow-123');
      expect(result.name).toBe(workflowData.name);
    });

    it('should handle Slack slash commands', async () => {
      const command = {
        command: '/contract-status',
        text: 'CONTRACT-001',
        userId: 'U123456',
        channelId: 'C123456'
      };

      const response = await service.handleSlackCommand(command);
      
      expect(response.response_type).toBe('in_channel');
      expect(response.text).toContain('CONTRACT-001');
    });

    it('should send interactive Slack message', async () => {
      const message = {
        channel: '#legal',
        text: 'Contract requires approval',
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: 'Please review and approve this contract' }
          },
          {
            type: 'actions',
            elements: [
              { type: 'button', text: { type: 'plain_text', text: 'Approve' }, value: 'approve' },
              { type: 'button', text: { type: 'plain_text', text: 'Reject' }, value: 'reject' }
            ]
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ts: '1234567890.123456' })
      });

      const result = await service.sendSlackInteractiveMessage(message);
      
      expect(result.messageId).toBe('1234567890.123456');
      expect(result.success).toBe(true);
    });

    it('should subscribe to Slack events', async () => {
      const eventCallback = vi.fn();
      
      await service.subscribeToSlackEvents(['message', 'file_shared'], eventCallback);
      
      // Simulate event
      const mockEvent = {
        type: 'message',
        channel: 'C123456',
        user: 'U123456',
        text: 'New contract uploaded'
      };

      await service.handleSlackEvent(mockEvent);
      
      expect(eventCallback).toHaveBeenCalledWith(mockEvent);
    });

    it('should upload file to Slack', async () => {
      const file = new File(['contract content'], 'contract.pdf', { type: 'application/pdf' });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          file: { id: 'F123456', name: 'contract.pdf' }
        })
      });

      const result = await service.uploadFileToSlack('#legal', file, {
        title: 'New Contract',
        initial_comment: 'Please review this contract'
      });
      
      expect(result.fileId).toBe('F123456');
      expect(result.success).toBe(true);
    });

    it('should get Slack user presence', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          presence: 'active',
          online: true
        })
      });

      const presence = await service.getSlackPresence('U123456');
      
      expect(presence.status).toBe(PresenceStatus.ACTIVE);
      expect(presence.online).toBe(true);
    });
  });

  describe('SharePoint Integration', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'sharepoint-token' })
      });
      await service.configureSharePoint(mockSharePointConfig);
    });

    it('should create SharePoint document library', async () => {
      const libraryData = {
        name: 'Contract Library',
        description: 'Library for storing legal contracts',
        template: 'documentLibrary'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'lib-123',
          name: libraryData.name,
          webUrl: 'https://tenant.sharepoint.com/sites/legal/lib-123'
        })
      });

      const result = await service.createSharePointLibrary(libraryData);
      
      expect(result.id).toBe('lib-123');
      expect(result.name).toBe(libraryData.name);
    });

    it('should manage SharePoint list', async () => {
      const listData = {
        displayName: 'Contract Tracking',
        description: 'Track contract status and approvals',
        template: 'genericList',
        columns: [
          { name: 'ContractId', type: 'text' },
          { name: 'Status', type: 'choice', choices: ['Draft', 'Review', 'Approved'] }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'list-123',
          displayName: listData.displayName
        })
      });

      const result = await service.createSharePointList(listData);
      
      expect(result.id).toBe('list-123');
      expect(result.displayName).toBe(listData.displayName);
    });

    it('should upload document to SharePoint', async () => {
      const file = new File(['contract content'], 'contract.pdf', { type: 'application/pdf' });
      const metadata = {
        title: 'Service Agreement',
        category: 'Legal',
        tags: ['contract', 'service']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'doc-123',
          name: 'contract.pdf',
          webUrl: 'https://tenant.sharepoint.com/sites/legal/doc-123'
        })
      });

      const result = await service.uploadToSharePoint('lib-123', file, metadata);
      
      expect(result.documentId).toBe('doc-123');
      expect(result.webUrl).toContain('sharepoint.com');
    });

    it('should manage SharePoint permissions', async () => {
      const permissions = {
        documentId: 'doc-123',
        permissions: [
          { userId: 'user1@example.com', role: 'read' },
          { userId: 'user2@example.com', role: 'edit' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await service.updateSharePointPermissions(permissions);
      
      expect(result.success).toBe(true);
    });

    it('should search SharePoint content', async () => {
      const searchQuery = {
        query: 'contract AND status:approved',
        library: 'lib-123',
        filters: { contentType: 'Document' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          PrimaryQueryResult: {
            RelevantResults: {
              Table: {
                Rows: [
                  { Cells: [{ Key: 'Title', Value: 'Service Agreement' }] }
                ]
              }
            }
          }
        })
      });

      const results = await service.searchSharePoint(searchQuery);
      
      expect(results.documents).toHaveLength(1);
      expect(results.documents[0].title).toBe('Service Agreement');
    });
  });

  describe('Real-time Messaging', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token' })
      });
      await service.configureTeams(mockTeamsConfig);
      await service.configureSlack(mockSlackConfig);
    });

    it('should establish WebSocket connection', async () => {
      await service.initializeRealTimeMessaging();
      
      expect(WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('ws://'),
        expect.any(Array)
      );
    });

    it('should send cross-platform message', async () => {
      const message = {
        content: 'Contract review completed',
        platforms: [PlatformType.TEAMS, PlatformType.SLACK],
        recipients: ['channel-123', '#legal'],
        priority: MessagePriority.NORMAL
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ messageId: 'teams-msg' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ts: 'slack-msg' }) });

      const results = await service.sendCrossPlatformMessage(message);
      
      expect(results).toHaveLength(2);
      expect(results[0].platform).toBe(PlatformType.TEAMS);
      expect(results[1].platform).toBe(PlatformType.SLACK);
    });

    it('should handle real-time presence updates', async () => {
      const presenceCallback = vi.fn();
      
      service.subscribeToPresenceUpdates(presenceCallback);
      
      // Simulate WebSocket message
      const mockPresenceUpdate = {
        type: 'presence_update',
        userId: 'user1@example.com',
        status: PresenceStatus.BUSY,
        platform: PlatformType.TEAMS
      };

      // Find the message handler and call it
      const messageHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'message')?.[1];
      
      if (messageHandler) {
        messageHandler({ 
          data: JSON.stringify(mockPresenceUpdate) 
        });
      }
      
      expect(presenceCallback).toHaveBeenCalledWith(mockPresenceUpdate);
    });
  });

  describe('File Synchronization', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token' })
      });
      await service.configureSharePoint(mockSharePointConfig);
      await service.configureSlack(mockSlackConfig);
    });

    it('should synchronize files across platforms', async () => {
      const syncConfig = {
        sourceId: 'sharepoint-doc-123',
        sourcePlatform: PlatformType.SHAREPOINT,
        targetPlatforms: [PlatformType.SLACK],
        syncMode: 'bidirectional' as const
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            downloadUrl: 'https://sharepoint.com/download/doc-123' 
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            file: { id: 'slack-file-123' } 
          })
        });

      const result = await service.synchronizeFile(syncConfig);
      
      expect(result.success).toBe(true);
      expect(result.syncedPlatforms).toContain(PlatformType.SLACK);
    });

    it('should handle file version conflicts', async () => {
      const conflictData = {
        fileId: 'doc-123',
        conflictingVersions: [
          { platform: PlatformType.SHAREPOINT, version: '1.2' },
          { platform: PlatformType.SLACK, version: '1.1' }
        ]
      };

      const resolution = await service.resolveFileConflict(conflictData, {
        strategy: 'latest_wins'
      });
      
      expect(resolution.resolvedVersion).toBe('1.2');
      expect(resolution.selectedPlatform).toBe(PlatformType.SHAREPOINT);
    });
  });

  describe('Activity Feeds and Notifications', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token' })
      });
      await service.configureTeams(mockTeamsConfig);
      await service.configureSlack(mockSlackConfig);
    });

    it('should create unified activity stream', async () => {
      const filters = {
        platforms: [PlatformType.TEAMS, PlatformType.SLACK],
        activityTypes: [ActivityType.FILE_SHARED, ActivityType.MESSAGE_SENT],
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        }
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            { id: 'activity-1', type: 'file_shared', platform: 'teams' }
          ])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            { id: 'activity-2', type: 'message_sent', platform: 'slack' }
          ])
        });

      const activities = await service.getUnifiedActivityStream(filters);
      
      expect(activities).toHaveLength(2);
      expect(activities[0].platform).toBe(PlatformType.TEAMS);
      expect(activities[1].platform).toBe(PlatformType.SLACK);
    });

    it('should manage smart notifications', async () => {
      const notificationRule = {
        name: 'Contract Review Alert',
        conditions: {
          keywords: ['contract', 'review'],
          priority: MessagePriority.HIGH,
          platforms: [PlatformType.TEAMS]
        },
        actions: {
          notify: true,
          escalate: true,
          forward: ['manager@example.com']
        }
      };

      const result = await service.createNotificationRule(notificationRule);
      
      expect(result.ruleId).toBeDefined();
      expect(result.active).toBe(true);
    });
  });

  describe('Error Handling and Rate Limiting', () => {
    it('should handle rate limiting gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '60' }),
        json: () => Promise.resolve({ error: 'Rate limit exceeded' })
      });

      const startTime = Date.now();
      
      try {
        await service.configureTeams(mockTeamsConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(CollaborationError);
        expect((error as CollaborationError).code).toBe(ErrorCode.RATE_LIMITED);
      }
    });

    it('should implement retry logic for transient failures', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Internal server error' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'token' })
        });

      await service.configureTeams(mockTeamsConfig);
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(service.getStatus()).toBe(IntegrationStatus.CONNECTED);
    });

    it('should handle network failures', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.configureTeams(mockTeamsConfig))
        .rejects.toThrow(CollaborationError);
    });

    it('should validate tenant isolation', async () => {
      const anotherService = new CollaborationPlatformService('tenant-456');
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token' })
      });

      await service.configureTeams(mockTeamsConfig);
      await anotherService.configureTeams(mockTeamsConfig);

      // Services should maintain separate state
      expect(service.getTenantId()).not.toBe(anotherService.getTenantId());
      
      anotherService.destroy();
    });
  });

  describe('Caching and Performance', () => {
    it('should cache authentication tokens', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ 
          access_token: 'token',
          expires_in: 3600
        })
      });

      await service.configureTeams(mockTeamsConfig);
      await service.configureTeams(mockTeamsConfig); // Second call should use cache
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should refresh expired tokens automatically', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            access_token: 'token1',
            expires_in: 1 // 1 second
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            access_token: 'token2',
            expires_in: 3600
          })
        });

      await service.configureTeams(mockTeamsConfig);
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      await service.getTeamsPresence('user@example.com');
      
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + refresh + API call
    });

    it('should implement request deduplication', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ presence: 'Available' })
      });

      // Make multiple simultaneous requests
      const promises = [
        service.getTeamsPresence('user@example.com'),
        service.getTeamsPresence('user@example.com'),
        service.getTeamsPresence('user@example.com')
      ];

      await Promise.all(promises);
      
      // Should only make one actual request
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multi-tenant Support', () => {
    it('should isolate data between tenants', async () => {
      const tenant1Service = new CollaborationPlatformService('tenant-1');
      const tenant2Service = new CollaborationPlatformService('tenant-2');

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token' })
      });

      await tenant1Service.configureTeams(mockTeamsConfig);
      await tenant2Service.configureSlack(mockSlackConfig);

      expect(tenant1Service.getIntegratedPlatforms()).toEqual([PlatformType.TEAMS]);
      expect(tenant2Service.getIntegratedPlatforms()).toEqual([PlatformType.SLACK]);

      tenant1Service.destroy();
      tenant2Service.destroy();
    });

    it('should include tenant context in all API calls', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token' })
      });

      await service.configureTeams(mockTeamsConfig);
      await service.getTeamsPresence('user@example.com');

      // Verify tenant ID is included in requests
      const calls = mockFetch.mock.calls;
      expect(calls.some(call => 
        call[1]?.headers?.['X-Tenant-ID'] === mockTenantId
      )).toBe(true);
    });
  });
});