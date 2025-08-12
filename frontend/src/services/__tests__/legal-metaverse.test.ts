import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { LegalMetaverseService } from '../legal-metaverse.service';
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
  Quaternion
} from '../../types/revolutionary-features.types';

// Mock fetch globally
global.fetch = vi.fn();
const mockFetch = fetch as Mock;

describe('LegalMetaverseService', () => {
  let service: LegalMetaverseService;
  const mockBaseUrl = 'https://api.example.com';
  const mockAuthToken = 'mock-token';

  beforeEach(() => {
    service = new LegalMetaverseService(mockBaseUrl, mockAuthToken);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to create mock transform
  const createMockTransform = (): Transform3D => ({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 }
  });

  // Helper function to create mock environment
  const createMockEnvironment = (): VirtualEnvironment => ({
    id: 'env-1',
    name: 'Test Courtroom',
    type: 'courtroom',
    maxParticipants: 10,
    isActive: true,
    settings: {
      lighting: 'natural',
      ambience: 'courtroom',
      accessibility: {
        textToSpeech: false,
        subtitles: false,
        highContrast: false,
        largeText: false,
        voiceCommands: false
      },
      privacy: 'private'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  });

  describe('Environment Management', () => {
    it('should create a virtual environment successfully', async () => {
      const environmentData = {
        name: 'Test Courtroom',
        type: 'courtroom' as const,
        maxParticipants: 10,
        settings: {
          lighting: 'natural' as const,
          ambience: 'courtroom' as const,
          accessibility: {
            textToSpeech: false,
            subtitles: false,
            highContrast: false,
            largeText: false,
            voiceCommands: false
          },
          privacy: 'private' as PrivacyLevel
        }
      };

      const mockResponse = createMockEnvironment();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.createEnvironment(environmentData);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/environments`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockAuthToken}`
          }),
          body: JSON.stringify(environmentData)
        })
      );
    });

    it('should get environment by id', async () => {
      const environmentId = 'env-1';
      const mockResponse = createMockEnvironment();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.getEnvironment(environmentId);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/environments/${environmentId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockAuthToken}`
          })
        })
      );
    });

    it('should list all environments with filtering', async () => {
      const filters = { type: 'courtroom', isActive: true };
      const mockEnvironments = [createMockEnvironment()];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockEnvironments,
          pagination: { page: 1, limit: 10, total: 1, pages: 1 }
        })
      });

      const result = await service.listEnvironments(filters);

      expect(result.data).toEqual(mockEnvironments);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/environments?type=courtroom&isActive=true`,
        expect.any(Object)
      );
    });

    it('should update environment settings', async () => {
      const environmentId = 'env-1';
      const updates = {
        settings: {
          lighting: 'artificial' as const,
          privacy: 'confidential' as PrivacyLevel
        }
      };

      const mockResponse = { ...createMockEnvironment(), ...updates };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.updateEnvironment(environmentId, updates);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/environments/${environmentId}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updates)
        })
      );
    });

    it('should delete environment', async () => {
      const environmentId = 'env-1';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.deleteEnvironment(environmentId);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/environments/${environmentId}`,
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });

    it('should activate environment', async () => {
      const environmentId = 'env-1';
      const mockResponse = { ...createMockEnvironment(), isActive: true };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.activateEnvironment(environmentId);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/environments/${environmentId}/activate`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should deactivate environment', async () => {
      const environmentId = 'env-1';
      const mockResponse = { ...createMockEnvironment(), isActive: false };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.deactivateEnvironment(environmentId);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/environments/${environmentId}/deactivate`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });

  describe('Avatar Management', () => {
    it('should create virtual avatar', async () => {
      const avatarData = {
        userId: 'user-1',
        name: 'Test Avatar',
        appearance: {
          model: 'lawyer-male-1',
          textures: ['skin-1', 'suit-1'],
          accessories: ['glasses'],
          clothing: ['business-suit'],
          customizations: { height: 1.8 }
        } as AvatarAppearance,
        position: createMockTransform()
      };

      const mockResponse: VirtualAvatar = {
        id: 'avatar-1',
        ...avatarData,
        animations: [],
        isActive: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.createAvatar(avatarData);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/avatars`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(avatarData)
        })
      );
    });

    it('should get avatar by id', async () => {
      const avatarId = 'avatar-1';
      const mockResponse: VirtualAvatar = {
        id: avatarId,
        userId: 'user-1',
        name: 'Test Avatar',
        appearance: {
          model: 'lawyer-male-1',
          textures: [],
          accessories: [],
          clothing: [],
          customizations: {}
        },
        position: createMockTransform(),
        animations: [],
        isActive: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.getAvatar(avatarId);

      expect(result).toEqual(mockResponse);
    });

    it('should update avatar appearance', async () => {
      const avatarId = 'avatar-1';
      const appearance: Partial<AvatarAppearance> = {
        accessories: ['glasses', 'watch']
      };

      const mockResponse: VirtualAvatar = {
        id: avatarId,
        userId: 'user-1',
        name: 'Test Avatar',
        appearance: {
          model: 'lawyer-male-1',
          textures: [],
          accessories: ['glasses', 'watch'],
          clothing: [],
          customizations: {}
        },
        position: createMockTransform(),
        animations: [],
        isActive: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.updateAvatarAppearance(avatarId, appearance);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/avatars/${avatarId}/appearance`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(appearance)
        })
      );
    });

    it('should update avatar position', async () => {
      const avatarId = 'avatar-1';
      const transform: Transform3D = {
        position: { x: 1, y: 0, z: 1 },
        rotation: { x: 0, y: 0.5, z: 0, w: 0.866 },
        scale: { x: 1, y: 1, z: 1 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.updateAvatarPosition(avatarId, transform);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/avatars/${avatarId}/position`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(transform)
        })
      );
    });

    it('should play avatar animation', async () => {
      const avatarId = 'avatar-1';
      const animationName = 'wave';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.playAvatarAnimation(avatarId, animationName);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/avatars/${avatarId}/animate`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ animation: animationName })
        })
      );
    });
  });

  describe('Session Management', () => {
    it('should create virtual session', async () => {
      const sessionData = {
        environmentId: 'env-1',
        startTime: new Date(),
        participants: []
      };

      const mockResponse: VirtualSession = {
        id: 'session-1',
        ...sessionData,
        status: 'scheduled',
        participants: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.createSession(sessionData);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/sessions`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            ...sessionData,
            startTime: sessionData.startTime.toISOString()
          })
        })
      );
    });

    it('should join session', async () => {
      const sessionId = 'session-1';
      const participantData = {
        userId: 'user-1',
        avatarId: 'avatar-1',
        role: 'attorney' as const
      };

      const mockParticipant: VirtualParticipant = {
        ...participantData,
        permissions: {
          canSpeak: true,
          canMove: true,
          canManipulateObjects: true,
          canRecord: false,
          canInviteOthers: false
        },
        joinedAt: new Date()
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockParticipant })
      });

      const result = await service.joinSession(sessionId, participantData);

      expect(result).toEqual(mockParticipant);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/sessions/${sessionId}/join`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(participantData)
        })
      );
    });

    it('should leave session', async () => {
      const sessionId = 'session-1';
      const userId = 'user-1';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.leaveSession(sessionId, userId);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/sessions/${sessionId}/leave`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ userId })
        })
      );
    });

    it('should start session', async () => {
      const sessionId = 'session-1';
      const mockResponse: VirtualSession = {
        id: sessionId,
        environmentId: 'env-1',
        participants: [],
        startTime: new Date(),
        status: 'active'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.startSession(sessionId);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/sessions/${sessionId}/start`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should end session', async () => {
      const sessionId = 'session-1';
      const mockResponse: VirtualSession = {
        id: sessionId,
        environmentId: 'env-1',
        participants: [],
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.endSession(sessionId);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/sessions/${sessionId}/end`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should get session by id', async () => {
      const sessionId = 'session-1';
      const mockResponse: VirtualSession = {
        id: sessionId,
        environmentId: 'env-1',
        participants: [],
        startTime: new Date(),
        status: 'active'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.getSession(sessionId);

      expect(result).toEqual(mockResponse);
    });

    it('should list active sessions', async () => {
      const mockSessions: VirtualSession[] = [{
        id: 'session-1',
        environmentId: 'env-1',
        participants: [],
        startTime: new Date(),
        status: 'active'
      }];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockSessions,
          pagination: { page: 1, limit: 10, total: 1, pages: 1 }
        })
      });

      const result = await service.listActiveSessions();

      expect(result.data).toEqual(mockSessions);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/sessions/active`,
        expect.any(Object)
      );
    });
  });

  describe('Collaboration Features', () => {
    it('should share document in virtual space', async () => {
      const sessionId = 'session-1';
      const documentData = {
        documentId: 'doc-1',
        position: { x: 0, y: 1.5, z: -2 } as Vector3D,
        permissions: ['view', 'comment']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.shareDocument(sessionId, documentData);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/sessions/${sessionId}/documents`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(documentData)
        })
      );
    });

    it('should create spatial annotation', async () => {
      const sessionId = 'session-1';
      const annotationData = {
        type: 'comment' as const,
        content: 'Review this clause',
        position: { x: 1, y: 1, z: 0 } as Vector3D,
        targetId: 'doc-1'
      };

      const mockResponse = {
        id: 'annotation-1',
        ...annotationData,
        author: 'user-1',
        createdAt: new Date()
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.createSpatialAnnotation(sessionId, annotationData);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/sessions/${sessionId}/annotations`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(annotationData)
        })
      );
    });

    it('should enable spatial voice communication', async () => {
      const sessionId = 'session-1';
      const settings = {
        spatialAudio: true,
        range: 10,
        volume: 0.8
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.enableSpatialVoice(sessionId, settings);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/sessions/${sessionId}/voice`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(settings)
        })
      );
    });

    it('should create virtual whiteboard', async () => {
      const sessionId = 'session-1';
      const whiteboardData = {
        name: 'Contract Discussion',
        position: { x: 0, y: 2, z: -3 } as Vector3D,
        size: { x: 3, y: 2, z: 0.1 } as Vector3D
      };

      const mockResponse = {
        id: 'whiteboard-1',
        ...whiteboardData,
        createdAt: new Date()
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.createVirtualWhiteboard(sessionId, whiteboardData);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/sessions/${sessionId}/whiteboards`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(whiteboardData)
        })
      );
    });
  });

  describe('Recording and Playback', () => {
    it('should start session recording', async () => {
      const sessionId = 'session-1';
      const recordingSettings = {
        format: 'vr' as const,
        quality: 'high' as const,
        includeAudio: true,
        includeParticipants: true
      };

      const mockResponse: SessionRecording = {
        id: 'recording-1',
        format: 'vr',
        quality: 'high',
        fileSize: 0,
        duration: 0,
        url: ''
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.startRecording(sessionId, recordingSettings);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/sessions/${sessionId}/recording/start`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(recordingSettings)
        })
      );
    });

    it('should stop session recording', async () => {
      const sessionId = 'session-1';
      const recordingId = 'recording-1';

      const mockResponse: SessionRecording = {
        id: recordingId,
        format: 'vr',
        quality: 'high',
        fileSize: 1024000,
        duration: 3600,
        url: 'https://storage.example.com/recording-1.vr'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.stopRecording(sessionId, recordingId);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/sessions/${sessionId}/recording/${recordingId}/stop`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should get recording by id', async () => {
      const recordingId = 'recording-1';
      const mockResponse: SessionRecording = {
        id: recordingId,
        format: 'vr',
        quality: 'high',
        fileSize: 1024000,
        duration: 3600,
        url: 'https://storage.example.com/recording-1.vr'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.getRecording(recordingId);

      expect(result).toEqual(mockResponse);
    });

    it('should list session recordings', async () => {
      const sessionId = 'session-1';
      const mockRecordings: SessionRecording[] = [{
        id: 'recording-1',
        format: 'vr',
        quality: 'high',
        fileSize: 1024000,
        duration: 3600,
        url: 'https://storage.example.com/recording-1.vr'
      }];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockRecordings,
          pagination: { page: 1, limit: 10, total: 1, pages: 1 }
        })
      });

      const result = await service.listSessionRecordings(sessionId);

      expect(result.data).toEqual(mockRecordings);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          error: 'Environment not found'
        })
      });

      await expect(service.getEnvironment('invalid-id')).rejects.toThrow('Environment not found');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.getEnvironment('env-1')).rejects.toThrow('Network error');
    });

    it('should handle invalid JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      await expect(service.getEnvironment('env-1')).rejects.toThrow('Invalid JSON');
    });
  });

  describe('Compliance and Security', () => {
    it('should verify session compliance', async () => {
      const sessionId = 'session-1';
      const mockResponse = {
        isCompliant: true,
        checks: {
          privacy: true,
          recording: true,
          participation: true,
          security: true
        },
        violations: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.verifySessionCompliance(sessionId);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/sessions/${sessionId}/compliance`,
        expect.any(Object)
      );
    });

    it('should validate participant permissions', async () => {
      const sessionId = 'session-1';
      const userId = 'user-1';
      const action = 'manipulate_document';

      const mockResponse = {
        allowed: true,
        reason: 'User has attorney role with document manipulation permissions'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.validateParticipantPermission(sessionId, userId, action);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/sessions/${sessionId}/permissions/${userId}/${action}`,
        expect.any(Object)
      );
    });

    it('should audit session activities', async () => {
      const sessionId = 'session-1';
      const mockAuditLog = [
        {
          timestamp: new Date(),
          userId: 'user-1',
          action: 'document_shared',
          details: { documentId: 'doc-1' }
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockAuditLog,
          pagination: { page: 1, limit: 10, total: 1, pages: 1 }
        })
      });

      const result = await service.getSessionAuditLog(sessionId);

      expect(result.data).toEqual(mockAuditLog);
    });
  });

  describe('Performance Monitoring', () => {
    it('should get session performance metrics', async () => {
      const sessionId = 'session-1';
      const mockMetrics = {
        frameRate: 90,
        latency: 15,
        participantCount: 5,
        renderTime: 8.5,
        memoryUsage: 2048,
        warnings: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockMetrics })
      });

      const result = await service.getSessionMetrics(sessionId);

      expect(result).toEqual(mockMetrics);
    });

    it('should optimize session performance', async () => {
      const sessionId = 'session-1';
      const optimizations = {
        reduceLOD: true,
        enableCulling: true,
        compressAudio: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.optimizeSessionPerformance(sessionId, optimizations);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/metaverse/sessions/${sessionId}/optimize`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(optimizations)
        })
      );
    });
  });
});