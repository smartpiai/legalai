// Platform Types
export enum PlatformType {
  TEAMS = 'teams',
  SLACK = 'slack',
  SHAREPOINT = 'sharepoint'
}

export enum IntegrationStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  ERROR = 'error'
}

export enum PresenceStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  AWAY = 'away',
  DO_NOT_DISTURB = 'do_not_disturb',
  OFFLINE = 'offline',
  ACTIVE = 'active'
}

export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum NotificationType {
  MESSAGE = 'message',
  TASK_ASSIGNED = 'task_assigned',
  FILE_SHARED = 'file_shared',
  MEETING_SCHEDULED = 'meeting_scheduled',
  APPROVAL_REQUIRED = 'approval_required'
}

export enum ActivityType {
  MESSAGE_SENT = 'message_sent',
  FILE_SHARED = 'file_shared',
  FILE_MODIFIED = 'file_modified',
  MEETING_CREATED = 'meeting_created',
  CHANNEL_CREATED = 'channel_created',
  USER_JOINED = 'user_joined'
}

export enum FileType {
  DOCUMENT = 'document',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  ARCHIVE = 'archive',
  OTHER = 'other'
}

export enum ErrorCode {
  AUTHENTICATION_FAILED = 'authentication_failed',
  PLATFORM_NOT_CONFIGURED = 'platform_not_configured',
  API_ERROR = 'api_error',
  RATE_LIMITED = 'rate_limited',
  NETWORK_ERROR = 'network_error',
  FILE_UPLOAD_FAILED = 'file_upload_failed',
  FILE_NOT_FOUND = 'file_not_found',
  SYNC_FAILED = 'sync_failed',
  NOTIFICATION_FAILED = 'notification_failed',
  INVALID_PARAMETER = 'invalid_parameter',
  INTEGRATION_ERROR = 'integration_error'
}

// Configuration Interfaces
export interface TeamsConfig {
  clientId: string;
  tenantId: string;
  scope: string[];
  redirectUri: string;
  appId: string;
}

export interface SlackConfig {
  clientId: string;
  clientSecret: string;
  scope: string[];
  redirectUri: string;
  botToken: string;
}

export interface SharePointConfig {
  siteUrl: string;
  clientId: string;
  tenantId: string;
  scope: string[];
}

// Teams-specific Types
export interface TeamsAppConfig {
  appId: string;
  entityId: string;
  contentUrl: string;
}

export interface TeamsChannelData {
  displayName: string;
  description: string;
  membershipType: 'standard' | 'private';
}

export interface TeamsMeetingData {
  subject: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
}

// Slack-specific Types
export interface SlackWorkflowData {
  name: string;
  description: string;
  triggers: string[];
  steps: Array<{
    type: string;
    channel?: string;
    approvers?: string[];
  }>;
}

export interface SlackCommandData {
  command: string;
  text: string;
  userId: string;
  channelId: string;
}

export interface SlackInteractiveMessage {
  channel: string;
  text: string;
  blocks?: Array<{
    type: string;
    text?: { type: string; text: string };
    elements?: Array<{
      type: string;
      text: { type: string; text: string };
      value: string;
    }>;
  }>;
}

// SharePoint-specific Types
export interface SharePointLibraryData {
  name: string;
  description: string;
  template: string;
}

export interface SharePointListData {
  displayName: string;
  description: string;
  template: string;
  columns: Array<{
    name: string;
    type: string;
    choices?: string[];
  }>;
}

// Cross-platform Types
export interface CrossPlatformMessage {
  content: string;
  platforms: PlatformType[];
  recipients: string[];
  priority: MessagePriority;
}

export interface FileSyncConfig {
  sourceId: string;
  sourcePlatform: PlatformType;
  targetPlatforms: PlatformType[];
  syncMode: 'unidirectional' | 'bidirectional';
}

export interface ActivityStreamFilters {
  platforms: PlatformType[];
  activityTypes: ActivityType[];
  dateRange: {
    start: Date;
    end: Date;
  };
}

export interface NotificationRule {
  name: string;
  conditions: {
    keywords: string[];
    priority: MessagePriority;
    platforms: PlatformType[];
  };
  actions: {
    notify: boolean;
    escalate: boolean;
    forward: string[];
  };
}

// Result Types
export interface PresenceInfo {
  userId: string;
  status: PresenceStatus;
  activity: string;
  lastSeen: Date;
  platform: PlatformType;
  online?: boolean;
}

export interface FileShareResult {
  fileId: string;
  fileName: string;
  webUrl: string;
  shared: boolean;
  platform: PlatformType;
}

export interface NotificationResult {
  success: boolean;
  messageId: string;
  platform: PlatformType;
  recipients: string[];
}

export interface ActivityItem {
  id: string;
  type: ActivityType;
  platform: PlatformType;
  timestamp: Date;
  description: string;
  user: string;
  metadata?: any;
}

export interface UnifiedSearchResult {
  documents: Array<{
    id: string;
    title: string;
    url: string;
    modified: Date;
    author: string;
  }>;
  totalCount: number;
  platform: PlatformType;
}

// Error Class
export class CollaborationError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public originalError?: any
  ) {
    super(message);
    this.name = 'CollaborationError';
  }
}

// Event Types for WebSocket
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: Date;
  tenantId: string;
}

export interface PresenceUpdateEvent extends WebSocketMessage {
  type: 'presence_update';
  payload: {
    userId: string;
    status: PresenceStatus;
    platform: PlatformType;
  };
}

export interface ActivityNotificationEvent extends WebSocketMessage {
  type: 'activity_notification';
  payload: {
    activityType: ActivityType;
    description: string;
    user: string;
    platform: PlatformType;
  };
}

// Forward declaration for service class
export interface ICollaborationPlatformService {
  getTenantId(): string;
  getStatus(): IntegrationStatus;
  getIntegratedPlatforms(): PlatformType[];
  configureTeams(config: TeamsConfig): Promise<void>;
  configureSlack(config: SlackConfig): Promise<void>;
  configureSharePoint(config: SharePointConfig): Promise<void>;
  destroy(): void;
}

// Hook Types for React Integration
export interface UseCollaborationPlatform {
  service: ICollaborationPlatformService | null;
  status: IntegrationStatus;
  platforms: PlatformType[];
  isConnected: boolean;
  configure: (platform: PlatformType, config: any) => Promise<void>;
  disconnect: (platform: PlatformType) => Promise<void>;
  sendMessage: (message: CrossPlatformMessage) => Promise<any>;
  shareFile: (platform: PlatformType, file: File, options: any) => Promise<FileShareResult>;
  getPresence: (platform: PlatformType, userId: string) => Promise<PresenceInfo>;
}

// Store Types for State Management
export interface CollaborationStore {
  services: Map<string, ICollaborationPlatformService>;
  currentTenant: string | null;
  integrationStatus: Map<string, IntegrationStatus>;
  presenceData: Map<string, PresenceInfo>;
  activities: ActivityItem[];
  notifications: NotificationResult[];
  
  // Actions
  initializeService: (tenantId: string) => void;
  updateIntegrationStatus: (platform: PlatformType, status: IntegrationStatus) => void;
  updatePresence: (presence: PresenceInfo) => void;
  addActivity: (activity: ActivityItem) => void;
  addNotification: (notification: NotificationResult) => void;
  clearData: () => void;
}

// Configuration validation schemas (for runtime validation)
export interface ConfigValidationSchema {
  teams: {
    required: (keyof TeamsConfig)[];
    optional: (keyof TeamsConfig)[];
  };
  slack: {
    required: (keyof SlackConfig)[];
    optional: (keyof SlackConfig)[];
  };
  sharepoint: {
    required: (keyof SharePointConfig)[];
    optional: (keyof SharePointConfig)[];
  };
}

export const CONFIG_VALIDATION: ConfigValidationSchema = {
  teams: {
    required: ['clientId', 'tenantId', 'appId'],
    optional: ['scope', 'redirectUri']
  },
  slack: {
    required: ['clientId', 'clientSecret'],
    optional: ['scope', 'redirectUri', 'botToken']
  },
  sharepoint: {
    required: ['siteUrl', 'clientId', 'tenantId'],
    optional: ['scope']
  }
};