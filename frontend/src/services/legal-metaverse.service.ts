import {
  VirtualEnvironment,
  VirtualSession,
  VirtualAvatar,
  VirtualParticipant,
  EnvironmentSettings,
  AvatarAppearance,
  SessionRecording,
  ParticipantPermissions,
  PrivacyLevel,
  Transform3D,
  Vector3D,
  Quaternion,
  ApiResponse,
  PaginatedResponse,
  RevolutionaryError
} from '../types/revolutionary-features.types';

export interface CreateEnvironmentData {
  name: string;
  type: 'courtroom' | 'office' | 'library' | 'negotiation' | 'presentation';
  maxParticipants: number;
  settings: EnvironmentSettings;
}

export interface UpdateEnvironmentData {
  name?: string;
  maxParticipants?: number;
  settings?: Partial<EnvironmentSettings>;
}

export interface CreateAvatarData {
  userId: string;
  name: string;
  appearance: AvatarAppearance;
  position: Transform3D;
}

export interface CreateSessionData {
  environmentId: string;
  startTime: Date;
  participants: VirtualParticipant[];
}

export interface JoinSessionData {
  userId: string;
  avatarId: string;
  role: 'client' | 'attorney' | 'judge' | 'witness' | 'observer';
}

export interface DocumentShareData {
  documentId: string;
  position: Vector3D;
  permissions: string[];
}

export interface SpatialAnnotationData {
  type: 'comment' | 'highlight' | 'warning' | 'suggestion';
  content: string;
  position: Vector3D;
  targetId: string;
}

export interface RecordingSettings {
  format: 'vr' | '360video' | '3d' | 'traditional';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  includeAudio: boolean;
  includeParticipants: boolean;
}

export interface VoiceSettings {
  spatialAudio: boolean;
  range: number;
  volume: number;
}

export interface WhiteboardData {
  name: string;
  position: Vector3D;
  size: Vector3D;
}

export interface ComplianceResult {
  isCompliant: boolean;
  checks: {
    privacy: boolean;
    recording: boolean;
    participation: boolean;
    security: boolean;
  };
  violations: string[];
}

export interface PermissionResult {
  allowed: boolean;
  reason: string;
}

export interface AuditEntry {
  timestamp: Date;
  userId: string;
  action: string;
  details: Record<string, unknown>;
}

export interface SessionMetrics {
  frameRate: number;
  latency: number;
  participantCount: number;
  renderTime: number;
  memoryUsage: number;
  warnings: string[];
}

export interface OptimizationSettings {
  reduceLOD: boolean;
  enableCulling: boolean;
  compressAudio: boolean;
}

export class LegalMetaverseService {
  private baseUrl: string;
  private authToken: string;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
        ...options.headers,
      },
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      const response = await fetch(url, finalOptions);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      // Return the full response for paginated endpoints, otherwise return data
      return data.success ? (data.pagination ? data : data.data) : data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred');
    }
  }

  private buildQueryString(params: Record<string, unknown>): string {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    return queryParams.toString();
  }

  // Environment Management
  async createEnvironment(data: CreateEnvironmentData): Promise<VirtualEnvironment> {
    return this.makeRequest<VirtualEnvironment>('/metaverse/environments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getEnvironment(environmentId: string): Promise<VirtualEnvironment> {
    return this.makeRequest<VirtualEnvironment>(`/metaverse/environments/${environmentId}`);
  }

  async listEnvironments(filters: Record<string, unknown> = {}): Promise<PaginatedResponse<VirtualEnvironment>> {
    const queryString = this.buildQueryString(filters);
    const endpoint = `/metaverse/environments${queryString ? `?${queryString}` : ''}`;
    return this.makeRequest<PaginatedResponse<VirtualEnvironment>>(endpoint);
  }

  async updateEnvironment(environmentId: string, updates: UpdateEnvironmentData): Promise<VirtualEnvironment> {
    return this.makeRequest<VirtualEnvironment>(`/metaverse/environments/${environmentId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteEnvironment(environmentId: string): Promise<void> {
    await this.makeRequest<void>(`/metaverse/environments/${environmentId}`, {
      method: 'DELETE',
    });
  }

  async activateEnvironment(environmentId: string): Promise<VirtualEnvironment> {
    return this.makeRequest<VirtualEnvironment>(`/metaverse/environments/${environmentId}/activate`, {
      method: 'POST',
    });
  }

  async deactivateEnvironment(environmentId: string): Promise<VirtualEnvironment> {
    return this.makeRequest<VirtualEnvironment>(`/metaverse/environments/${environmentId}/deactivate`, {
      method: 'POST',
    });
  }

  // Avatar Management
  async createAvatar(data: CreateAvatarData): Promise<VirtualAvatar> {
    return this.makeRequest<VirtualAvatar>('/metaverse/avatars', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAvatar(avatarId: string): Promise<VirtualAvatar> {
    return this.makeRequest<VirtualAvatar>(`/metaverse/avatars/${avatarId}`);
  }

  async updateAvatarAppearance(avatarId: string, appearance: Partial<AvatarAppearance>): Promise<VirtualAvatar> {
    return this.makeRequest<VirtualAvatar>(`/metaverse/avatars/${avatarId}/appearance`, {
      method: 'PUT',
      body: JSON.stringify(appearance),
    });
  }

  async updateAvatarPosition(avatarId: string, transform: Transform3D): Promise<void> {
    await this.makeRequest<void>(`/metaverse/avatars/${avatarId}/position`, {
      method: 'PUT',
      body: JSON.stringify(transform),
    });
  }

  async playAvatarAnimation(avatarId: string, animationName: string): Promise<void> {
    await this.makeRequest<void>(`/metaverse/avatars/${avatarId}/animate`, {
      method: 'POST',
      body: JSON.stringify({ animation: animationName }),
    });
  }

  async deleteAvatar(avatarId: string): Promise<void> {
    await this.makeRequest<void>(`/metaverse/avatars/${avatarId}`, {
      method: 'DELETE',
    });
  }

  async listUserAvatars(userId: string): Promise<VirtualAvatar[]> {
    return this.makeRequest<VirtualAvatar[]>(`/metaverse/users/${userId}/avatars`);
  }

  // Session Management
  async createSession(data: CreateSessionData): Promise<VirtualSession> {
    const sessionData = {
      ...data,
      startTime: data.startTime.toISOString(),
    };

    return this.makeRequest<VirtualSession>('/metaverse/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  async getSession(sessionId: string): Promise<VirtualSession> {
    return this.makeRequest<VirtualSession>(`/metaverse/sessions/${sessionId}`);
  }

  async joinSession(sessionId: string, participantData: JoinSessionData): Promise<VirtualParticipant> {
    return this.makeRequest<VirtualParticipant>(`/metaverse/sessions/${sessionId}/join`, {
      method: 'POST',
      body: JSON.stringify(participantData),
    });
  }

  async leaveSession(sessionId: string, userId: string): Promise<void> {
    await this.makeRequest<void>(`/metaverse/sessions/${sessionId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async startSession(sessionId: string): Promise<VirtualSession> {
    return this.makeRequest<VirtualSession>(`/metaverse/sessions/${sessionId}/start`, {
      method: 'POST',
    });
  }

  async endSession(sessionId: string): Promise<VirtualSession> {
    return this.makeRequest<VirtualSession>(`/metaverse/sessions/${sessionId}/end`, {
      method: 'POST',
    });
  }

  async pauseSession(sessionId: string): Promise<VirtualSession> {
    return this.makeRequest<VirtualSession>(`/metaverse/sessions/${sessionId}/pause`, {
      method: 'POST',
    });
  }

  async resumeSession(sessionId: string): Promise<VirtualSession> {
    return this.makeRequest<VirtualSession>(`/metaverse/sessions/${sessionId}/resume`, {
      method: 'POST',
    });
  }

  async listActiveSessions(): Promise<PaginatedResponse<VirtualSession>> {
    return this.makeRequest<PaginatedResponse<VirtualSession>>('/metaverse/sessions/active');
  }

  async listUserSessions(userId: string): Promise<PaginatedResponse<VirtualSession>> {
    return this.makeRequest<PaginatedResponse<VirtualSession>>(`/metaverse/users/${userId}/sessions`);
  }

  // Collaboration Features
  async shareDocument(sessionId: string, documentData: DocumentShareData): Promise<void> {
    await this.makeRequest<void>(`/metaverse/sessions/${sessionId}/documents`, {
      method: 'POST',
      body: JSON.stringify(documentData),
    });
  }

  async removeSharedDocument(sessionId: string, documentId: string): Promise<void> {
    await this.makeRequest<void>(`/metaverse/sessions/${sessionId}/documents/${documentId}`, {
      method: 'DELETE',
    });
  }

  async createSpatialAnnotation(sessionId: string, annotationData: SpatialAnnotationData): Promise<any> {
    return this.makeRequest<any>(`/metaverse/sessions/${sessionId}/annotations`, {
      method: 'POST',
      body: JSON.stringify(annotationData),
    });
  }

  async deleteSpatialAnnotation(sessionId: string, annotationId: string): Promise<void> {
    await this.makeRequest<void>(`/metaverse/sessions/${sessionId}/annotations/${annotationId}`, {
      method: 'DELETE',
    });
  }

  async enableSpatialVoice(sessionId: string, settings: VoiceSettings): Promise<void> {
    await this.makeRequest<void>(`/metaverse/sessions/${sessionId}/voice`, {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  async disableSpatialVoice(sessionId: string): Promise<void> {
    await this.makeRequest<void>(`/metaverse/sessions/${sessionId}/voice`, {
      method: 'DELETE',
    });
  }

  async createVirtualWhiteboard(sessionId: string, whiteboardData: WhiteboardData): Promise<any> {
    return this.makeRequest<any>(`/metaverse/sessions/${sessionId}/whiteboards`, {
      method: 'POST',
      body: JSON.stringify(whiteboardData),
    });
  }

  async deleteVirtualWhiteboard(sessionId: string, whiteboardId: string): Promise<void> {
    await this.makeRequest<void>(`/metaverse/sessions/${sessionId}/whiteboards/${whiteboardId}`, {
      method: 'DELETE',
    });
  }

  async broadcastMessage(sessionId: string, message: string, targetUsers?: string[]): Promise<void> {
    await this.makeRequest<void>(`/metaverse/sessions/${sessionId}/broadcast`, {
      method: 'POST',
      body: JSON.stringify({ message, targetUsers }),
    });
  }

  // Recording and Playback
  async startRecording(sessionId: string, settings: RecordingSettings): Promise<SessionRecording> {
    return this.makeRequest<SessionRecording>(`/metaverse/sessions/${sessionId}/recording/start`, {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  async stopRecording(sessionId: string, recordingId: string): Promise<SessionRecording> {
    return this.makeRequest<SessionRecording>(`/metaverse/sessions/${sessionId}/recording/${recordingId}/stop`, {
      method: 'POST',
    });
  }

  async pauseRecording(sessionId: string, recordingId: string): Promise<void> {
    await this.makeRequest<void>(`/metaverse/sessions/${sessionId}/recording/${recordingId}/pause`, {
      method: 'POST',
    });
  }

  async resumeRecording(sessionId: string, recordingId: string): Promise<void> {
    await this.makeRequest<void>(`/metaverse/sessions/${sessionId}/recording/${recordingId}/resume`, {
      method: 'POST',
    });
  }

  async getRecording(recordingId: string): Promise<SessionRecording> {
    return this.makeRequest<SessionRecording>(`/metaverse/recordings/${recordingId}`);
  }

  async listSessionRecordings(sessionId: string): Promise<PaginatedResponse<SessionRecording>> {
    return this.makeRequest<PaginatedResponse<SessionRecording>>(`/metaverse/sessions/${sessionId}/recordings`);
  }

  async deleteRecording(recordingId: string): Promise<void> {
    await this.makeRequest<void>(`/metaverse/recordings/${recordingId}`, {
      method: 'DELETE',
    });
  }

  async exportRecording(recordingId: string, format: string): Promise<{ downloadUrl: string }> {
    return this.makeRequest<{ downloadUrl: string }>(`/metaverse/recordings/${recordingId}/export`, {
      method: 'POST',
      body: JSON.stringify({ format }),
    });
  }

  // Compliance and Security
  async verifySessionCompliance(sessionId: string): Promise<ComplianceResult> {
    return this.makeRequest<ComplianceResult>(`/metaverse/sessions/${sessionId}/compliance`);
  }

  async validateParticipantPermission(sessionId: string, userId: string, action: string): Promise<PermissionResult> {
    return this.makeRequest<PermissionResult>(`/metaverse/sessions/${sessionId}/permissions/${userId}/${action}`);
  }

  async updateParticipantPermissions(sessionId: string, userId: string, permissions: Partial<ParticipantPermissions>): Promise<void> {
    await this.makeRequest<void>(`/metaverse/sessions/${sessionId}/participants/${userId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify(permissions),
    });
  }

  async getSessionAuditLog(sessionId: string): Promise<PaginatedResponse<AuditEntry>> {
    return this.makeRequest<PaginatedResponse<AuditEntry>>(`/metaverse/sessions/${sessionId}/audit`);
  }

  async reportSecurityIncident(sessionId: string, incident: { type: string; description: string; severity: string }): Promise<void> {
    await this.makeRequest<void>(`/metaverse/sessions/${sessionId}/security/incident`, {
      method: 'POST',
      body: JSON.stringify(incident),
    });
  }

  async enablePrivacyMode(sessionId: string): Promise<void> {
    await this.makeRequest<void>(`/metaverse/sessions/${sessionId}/privacy/enable`, {
      method: 'POST',
    });
  }

  async disablePrivacyMode(sessionId: string): Promise<void> {
    await this.makeRequest<void>(`/metaverse/sessions/${sessionId}/privacy/disable`, {
      method: 'POST',
    });
  }

  // Performance Monitoring
  async getSessionMetrics(sessionId: string): Promise<SessionMetrics> {
    return this.makeRequest<SessionMetrics>(`/metaverse/sessions/${sessionId}/metrics`);
  }

  async optimizeSessionPerformance(sessionId: string, optimizations: OptimizationSettings): Promise<void> {
    await this.makeRequest<void>(`/metaverse/sessions/${sessionId}/optimize`, {
      method: 'POST',
      body: JSON.stringify(optimizations),
    });
  }

  async getEnvironmentMetrics(environmentId: string): Promise<any> {
    return this.makeRequest<any>(`/metaverse/environments/${environmentId}/metrics`);
  }

  async adjustQualitySettings(sessionId: string, quality: 'low' | 'medium' | 'high' | 'ultra'): Promise<void> {
    await this.makeRequest<void>(`/metaverse/sessions/${sessionId}/quality`, {
      method: 'PUT',
      body: JSON.stringify({ quality }),
    });
  }

  // Advanced Features
  async createCustomEnvironment(templateId: string, customizations: Record<string, unknown>): Promise<VirtualEnvironment> {
    return this.makeRequest<VirtualEnvironment>('/metaverse/environments/custom', {
      method: 'POST',
      body: JSON.stringify({ templateId, customizations }),
    });
  }

  async importEnvironmentAsset(environmentId: string, assetData: { type: string; url: string; metadata: any }): Promise<void> {
    await this.makeRequest<void>(`/metaverse/environments/${environmentId}/assets`, {
      method: 'POST',
      body: JSON.stringify(assetData),
    });
  }

  async enableAIAssistant(sessionId: string, assistantConfig: { type: string; capabilities: string[] }): Promise<void> {
    await this.makeRequest<void>(`/metaverse/sessions/${sessionId}/ai-assistant`, {
      method: 'POST',
      body: JSON.stringify(assistantConfig),
    });
  }

  async scheduleSession(sessionData: CreateSessionData & { scheduledTime: Date }): Promise<VirtualSession> {
    const data = {
      ...sessionData,
      startTime: sessionData.startTime.toISOString(),
      scheduledTime: sessionData.scheduledTime.toISOString(),
    };

    return this.makeRequest<VirtualSession>('/metaverse/sessions/schedule', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async inviteParticipants(sessionId: string, invitations: { email: string; role: string }[]): Promise<void> {
    await this.makeRequest<void>(`/metaverse/sessions/${sessionId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ invitations }),
    });
  }

  async createEnvironmentTemplate(name: string, environmentId: string, isPublic: boolean = false): Promise<any> {
    return this.makeRequest<any>('/metaverse/templates', {
      method: 'POST',
      body: JSON.stringify({ name, environmentId, isPublic }),
    });
  }

  async listEnvironmentTemplates(): Promise<any[]> {
    return this.makeRequest<any[]>('/metaverse/templates');
  }

  async cloneEnvironment(environmentId: string, name: string): Promise<VirtualEnvironment> {
    return this.makeRequest<VirtualEnvironment>(`/metaverse/environments/${environmentId}/clone`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }
}