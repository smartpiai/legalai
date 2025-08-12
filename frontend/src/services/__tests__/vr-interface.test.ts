import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { VRInterfaceService } from '../vr-interface.service';
import {
  VRSession,
  VRDevice,
  VRController,
  VRButton,
  TouchpadData,
  EyeTrackingData,
  HandTrackingData,
  HandData,
  FingerData,
  GestureType,
  SpatialUI,
  UIContent,
  UIInteraction,
  Vector3D,
  Quaternion,
  Transform3D,
  VRCapabilities,
  PerformanceMetrics,
  OptimizationSettings
} from '../../types/revolutionary-features.types';

// Mock WebXR API
const mockNavigator = {
  xr: {
    isSessionSupported: vi.fn(),
    requestSession: vi.fn(),
  }
};

// Mock XR Session
const mockXRSession = {
  requestReferenceSpace: vi.fn(),
  requestAnimationFrame: vi.fn(),
  end: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  inputSources: [],
  visibilityState: 'visible'
};

// Mock XR Frame
const mockXRFrame = {
  getPose: vi.fn(),
  getViewerPose: vi.fn(),
  session: mockXRSession
};

// Mock XR Reference Space
const mockXRReferenceSpace = {
  getOffsetReferenceSpace: vi.fn()
};

// Mock global objects
global.navigator = mockNavigator as any;
global.XRSession = vi.fn(() => mockXRSession) as any;
global.fetch = vi.fn();
const mockFetch = fetch as Mock;

describe('VRInterfaceService', () => {
  let service: VRInterfaceService;
  const mockBaseUrl = 'https://api.example.com';
  const mockAuthToken = 'mock-token';

  beforeEach(() => {
    service = new VRInterfaceService(mockBaseUrl, mockAuthToken);
    mockFetch.mockClear();
    vi.clearAllMocks();
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

  // Helper function to create mock VR device
  const createMockVRDevice = (): VRDevice => ({
    type: 'quest',
    model: 'Quest 3',
    resolution: { width: 2064, height: 2208 },
    refreshRate: 90,
    fov: 110,
    capabilities: {
      hasHandTracking: true,
      hasEyeTracking: true,
      hasHapticFeedback: true,
      hasVoiceInput: true,
      supports6DOF: true
    }
  });

  // Helper function to create mock VR session
  const createMockVRSession = (): VRSession => ({
    id: 'vr-session-1',
    deviceInfo: createMockVRDevice(),
    controllers: [],
    isConnected: true,
    startTime: new Date()
  });

  describe('VR Session Management', () => {
    it('should check VR support', async () => {
      mockNavigator.xr.isSessionSupported.mockResolvedValue(true);

      const isSupported = await service.isVRSupported();

      expect(isSupported).toBe(true);
      expect(mockNavigator.xr.isSessionSupported).toHaveBeenCalledWith('immersive-vr');
    });

    it('should check AR support', async () => {
      mockNavigator.xr.isSessionSupported.mockResolvedValue(true);

      const isSupported = await service.isARSupported();

      expect(isSupported).toBe(true);
      expect(mockNavigator.xr.isSessionSupported).toHaveBeenCalledWith('immersive-ar');
    });

    it('should handle unsupported VR', async () => {
      mockNavigator.xr.isSessionSupported.mockResolvedValue(false);

      const isSupported = await service.isVRSupported();

      expect(isSupported).toBe(false);
    });

    it('should handle missing WebXR API', async () => {
      const originalNavigator = global.navigator;
      global.navigator = {} as any;

      const isSupported = await service.isVRSupported();

      expect(isSupported).toBe(false);

      global.navigator = originalNavigator;
    });

    it('should start VR session', async () => {
      const mockSession = createMockVRSession();
      mockNavigator.xr.requestSession.mockResolvedValue(mockXRSession);
      mockXRSession.requestReferenceSpace.mockResolvedValue(mockXRReferenceSpace);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockSession })
      });

      const session = await service.startVRSession({
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking']
      });

      expect(session).toEqual(mockSession);
      expect(mockNavigator.xr.requestSession).toHaveBeenCalledWith('immersive-vr', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking']
      });
    });

    it('should end VR session', async () => {
      const sessionId = 'vr-session-1';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.endVRSession(sessionId);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/sessions/${sessionId}/end`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should get current VR session', async () => {
      const mockSession = createMockVRSession();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockSession })
      });

      const session = await service.getCurrentSession();

      expect(session).toEqual(mockSession);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/sessions/current`,
        expect.any(Object)
      );
    });

    it('should get VR device info', async () => {
      const mockDevice = createMockVRDevice();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockDevice })
      });

      const device = await service.getDeviceInfo();

      expect(device).toEqual(mockDevice);
    });

    it('should calibrate VR device', async () => {
      const calibrationData = {
        height: 1.75,
        playArea: { width: 3, height: 3 },
        trackingSpace: 'room-scale'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.calibrateDevice(calibrationData);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/device/calibrate`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(calibrationData)
        })
      );
    });
  });

  describe('Controller Management', () => {
    it('should get controllers', async () => {
      const mockControllers: VRController[] = [{
        id: 'controller-left',
        hand: 'left',
        position: { x: -0.5, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        buttons: [
          { id: 'trigger', name: 'Trigger', isPressed: false, isPrimary: true, value: 0 },
          { id: 'grip', name: 'Grip', isPressed: false, isPrimary: false, value: 0 }
        ],
        touchpad: {
          position: { x: 0, y: 0 },
          isTouched: false,
          isPressed: false
        },
        isConnected: true
      }];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockControllers })
      });

      const controllers = await service.getControllers();

      expect(controllers).toEqual(mockControllers);
    });

    it('should update controller state', async () => {
      const controllerId = 'controller-left';
      const state = {
        position: { x: -0.6, y: 1.1, z: -0.1 },
        rotation: { x: 0.1, y: 0, z: 0, w: 0.995 },
        buttons: [
          { id: 'trigger', name: 'Trigger', isPressed: true, isPrimary: true, value: 0.8 }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.updateControllerState(controllerId, state);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/controllers/${controllerId}/state`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(state)
        })
      );
    });

    it('should handle controller input', async () => {
      const inputData = {
        controllerId: 'controller-right',
        inputType: 'button',
        buttonId: 'trigger',
        value: 1,
        timestamp: Date.now()
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.handleControllerInput(inputData);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/input/controller`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(inputData)
        })
      );
    });

    it('should enable haptic feedback', async () => {
      const controllerId = 'controller-left';
      const hapticData = {
        intensity: 0.7,
        duration: 200,
        pattern: 'pulse'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.enableHapticFeedback(controllerId, hapticData);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/controllers/${controllerId}/haptic`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(hapticData)
        })
      );
    });
  });

  describe('Hand Tracking', () => {
    it('should enable hand tracking', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.enableHandTracking();

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/tracking/hands/enable`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should disable hand tracking', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.disableHandTracking();

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/tracking/hands/disable`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should get hand tracking data', async () => {
      const mockHandData: HandTrackingData = {
        leftHand: {
          position: { x: -0.3, y: 1.2, z: -0.2 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          fingers: [
            { name: 'thumb', joints: [], isBent: false, flexion: 0.1 },
            { name: 'index', joints: [], isBent: false, flexion: 0.0 },
            { name: 'middle', joints: [], isBent: false, flexion: 0.0 },
            { name: 'ring', joints: [], isBent: false, flexion: 0.0 },
            { name: 'pinky', joints: [], isBent: false, flexion: 0.0 }
          ],
          gesture: 'open',
          confidence: 0.95
        },
        rightHand: {
          position: { x: 0.3, y: 1.2, z: -0.2 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          fingers: [
            { name: 'thumb', joints: [], isBent: false, flexion: 0.1 },
            { name: 'index', joints: [], isBent: true, flexion: 0.8 },
            { name: 'middle', joints: [], isBent: false, flexion: 0.0 },
            { name: 'ring', joints: [], isBent: false, flexion: 0.0 },
            { name: 'pinky', joints: [], isBent: false, flexion: 0.0 }
          ],
          gesture: 'point',
          confidence: 0.92
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockHandData })
      });

      const handData = await service.getHandTrackingData();

      expect(handData).toEqual(mockHandData);
    });

    it('should recognize gesture', async () => {
      const handData: HandData = {
        position: { x: 0.3, y: 1.2, z: -0.2 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        fingers: [
          { name: 'thumb', joints: [], isBent: false, flexion: 0.1 },
          { name: 'index', joints: [], isBent: false, flexion: 0.0 },
          { name: 'middle', joints: [], isBent: true, flexion: 0.9 },
          { name: 'ring', joints: [], isBent: true, flexion: 0.9 },
          { name: 'pinky', joints: [], isBent: true, flexion: 0.9 }
        ],
        gesture: 'point',
        confidence: 0.88
      };

      const mockResult = {
        gesture: 'point' as GestureType,
        confidence: 0.88,
        description: 'Index finger extended, others closed'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResult })
      });

      const result = await service.recognizeGesture(handData);

      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/tracking/hands/gesture`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(handData)
        })
      );
    });

    it('should handle gesture command', async () => {
      const gestureCommand = {
        gesture: 'pinch' as GestureType,
        targetObject: 'document-1',
        action: 'select'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.handleGestureCommand(gestureCommand);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/input/gesture`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(gestureCommand)
        })
      );
    });
  });

  describe('Eye Tracking', () => {
    it('should enable eye tracking', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.enableEyeTracking();

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/tracking/eyes/enable`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should disable eye tracking', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.disableEyeTracking();

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/tracking/eyes/disable`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should get eye tracking data', async () => {
      const mockEyeData: EyeTrackingData = {
        leftEye: {
          position: { x: -0.03, y: 0, z: 0 },
          rotation: { x: 0.1, y: -0.05, z: 0, w: 0.995 },
          isOpen: true,
          blinkRate: 15
        },
        rightEye: {
          position: { x: 0.03, y: 0, z: 0 },
          rotation: { x: 0.1, y: 0.05, z: 0, w: 0.995 },
          isOpen: true,
          blinkRate: 15
        },
        gazeDirection: { x: 0, y: 0, z: -1 },
        focusPoint: { x: 0, y: 1.5, z: -2 },
        pupilDilation: 0.6
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockEyeData })
      });

      const eyeData = await service.getEyeTrackingData();

      expect(eyeData).toEqual(mockEyeData);
    });

    it('should handle gaze interaction', async () => {
      const gazeData = {
        targetObject: 'ui-button-1',
        gazeDirection: { x: 0, y: 0, z: -1 },
        focusPoint: { x: 0, y: 1.5, z: -2 },
        duration: 1500,
        action: 'select'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.handleGazeInteraction(gazeData);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/input/gaze`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(gazeData)
        })
      );
    });
  });

  describe('Voice Commands', () => {
    it('should enable voice recognition', async () => {
      const config = {
        language: 'en-US',
        continuous: true,
        interimResults: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.enableVoiceRecognition(config);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/voice/enable`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(config)
        })
      );
    });

    it('should disable voice recognition', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.disableVoiceRecognition();

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/voice/disable`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should process voice command', async () => {
      const command = {
        text: 'show contract details',
        confidence: 0.95,
        intent: 'display_document',
        entities: { documentType: 'contract' }
      };

      const mockResult = {
        understood: true,
        action: 'open_document',
        parameters: { type: 'contract', view: 'details' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResult })
      });

      const result = await service.processVoiceCommand(command);

      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/voice/command`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(command)
        })
      );
    });

    it('should register custom voice commands', async () => {
      const commands = [
        { phrase: 'open document', action: 'open_document' },
        { phrase: 'close window', action: 'close_window' },
        { phrase: 'next page', action: 'next_page' }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.registerVoiceCommands(commands);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/voice/commands`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ commands })
        })
      );
    });
  });

  describe('Spatial UI Management', () => {
    it('should create spatial UI element', async () => {
      const uiData = {
        type: 'panel' as const,
        transform: createMockTransform(),
        size: { x: 1, y: 0.8, z: 0.1 },
        content: {
          html: '<div>Contract Details</div>'
        },
        interactions: [
          { type: 'click' as const, callback: 'onPanelClick', parameters: {} }
        ]
      };

      const mockUI: SpatialUI = {
        id: 'ui-panel-1',
        ...uiData,
        isVisible: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockUI })
      });

      const ui = await service.createSpatialUI(uiData);

      expect(ui).toEqual(mockUI);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/ui/create`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(uiData)
        })
      );
    });

    it('should update spatial UI element', async () => {
      const uiId = 'ui-panel-1';
      const updates = {
        transform: {
          position: { x: 1, y: 0, z: -1 },
          rotation: { x: 0, y: 0.5, z: 0, w: 0.866 },
          scale: { x: 1.2, y: 1.2, z: 1 }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.updateSpatialUI(uiId, updates);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/ui/${uiId}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updates)
        })
      );
    });

    it('should delete spatial UI element', async () => {
      const uiId = 'ui-panel-1';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.deleteSpatialUI(uiId);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/ui/${uiId}`,
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });

    it('should show spatial UI element', async () => {
      const uiId = 'ui-panel-1';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.showSpatialUI(uiId);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/ui/${uiId}/show`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should hide spatial UI element', async () => {
      const uiId = 'ui-panel-1';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.hideSpatialUI(uiId);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/ui/${uiId}/hide`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should handle UI interaction', async () => {
      const interactionData = {
        uiId: 'ui-button-1',
        interactionType: 'click',
        inputSource: 'controller',
        position: { x: 0, y: 1.5, z: -2 },
        timestamp: Date.now()
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.handleUIInteraction(interactionData);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/ui/interact`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(interactionData)
        })
      );
    });
  });

  describe('Document Manipulation', () => {
    it('should create 3D document view', async () => {
      const documentData = {
        documentId: 'doc-1',
        position: { x: 0, y: 1.5, z: -1.5 },
        size: { x: 0.8, y: 1.2, z: 0.02 },
        pages: 10,
        currentPage: 1
      };

      const mockResult = {
        id: '3d-doc-1',
        ...documentData,
        meshId: 'doc-mesh-1'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResult })
      });

      const result = await service.create3DDocument(documentData);

      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/documents/create3d`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(documentData)
        })
      );
    });

    it('should manipulate document in 3D space', async () => {
      const documentId = '3d-doc-1';
      const manipulation = {
        action: 'rotate',
        rotation: { x: 0, y: 0.5, z: 0, w: 0.866 },
        animation: { duration: 500, easing: 'ease-in-out' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.manipulateDocument(documentId, manipulation);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/documents/${documentId}/manipulate`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(manipulation)
        })
      );
    });

    it('should highlight document text in VR', async () => {
      const documentId = '3d-doc-1';
      const highlightData = {
        page: 1,
        startPosition: { x: 0.1, y: 0.8 },
        endPosition: { x: 0.9, y: 0.7 },
        color: '#ffff00',
        opacity: 0.5
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.highlightDocumentText(documentId, highlightData);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/documents/${documentId}/highlight`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(highlightData)
        })
      );
    });

    it('should add 3D annotation to document', async () => {
      const documentId = '3d-doc-1';
      const annotationData = {
        position: { x: 0.5, y: 0.8, z: 0.01 },
        content: 'Review this clause',
        type: 'comment',
        author: 'user-1'
      };

      const mockResult = {
        id: 'annotation-1',
        ...annotationData,
        createdAt: new Date()
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResult })
      });

      const result = await service.add3DAnnotation(documentId, annotationData);

      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/documents/${documentId}/annotations`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(annotationData)
        })
      );
    });
  });

  describe('Performance Optimization', () => {
    it('should get VR performance metrics', async () => {
      const mockMetrics: PerformanceMetrics = {
        frameRate: 85,
        renderTime: 11.2,
        memoryUsage: 3072,
        cpuUsage: 65,
        gpuUsage: 78,
        networkLatency: 25,
        warnings: ['Frame rate below target']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockMetrics })
      });

      const metrics = await service.getPerformanceMetrics();

      expect(metrics).toEqual(mockMetrics);
    });

    it('should apply performance optimizations', async () => {
      const optimizations: OptimizationSettings = {
        levelOfDetail: true,
        culling: true,
        compression: true,
        caching: true,
        streaming: true,
        quality: 'medium'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.applyOptimizations(optimizations);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/performance/optimize`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(optimizations)
        })
      );
    });

    it('should adjust render quality', async () => {
      const quality = 'high';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.adjustRenderQuality(quality);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/performance/quality`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ quality })
        })
      );
    });

    it('should monitor performance in real-time', async () => {
      const callback = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.startPerformanceMonitoring(callback);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/performance/monitor/start`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should stop performance monitoring', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.stopPerformanceMonitoring();

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/performance/monitor/stop`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle VR session startup errors', async () => {
      mockNavigator.xr.requestSession.mockRejectedValue(new Error('VR device not connected'));

      await expect(service.startVRSession({})).rejects.toThrow('VR device not connected');
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          error: 'Internal server error'
        })
      });

      await expect(service.getDeviceInfo()).rejects.toThrow('Internal server error');
    });

    it('should handle network connectivity issues', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.getCurrentSession()).rejects.toThrow('Network error');
    });

    it('should handle invalid hand tracking data', async () => {
      const invalidHandData = {
        position: { x: NaN, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        fingers: [],
        gesture: 'invalid' as GestureType,
        confidence: -1
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'Invalid hand tracking data'
        })
      });

      await expect(service.recognizeGesture(invalidHandData)).rejects.toThrow('Invalid hand tracking data');
    });
  });

  describe('Accessibility Features', () => {
    it('should enable accessibility mode', async () => {
      const accessibilitySettings = {
        largeText: true,
        highContrast: true,
        voiceOutput: true,
        reducedMotion: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.enableAccessibilityMode(accessibilitySettings);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/accessibility/enable`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(accessibilitySettings)
        })
      );
    });

    it('should provide voice guidance', async () => {
      const guidanceText = 'Use your controller to point at the document you want to open';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.provideVoiceGuidance(guidanceText);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/accessibility/voice-guidance`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ text: guidanceText })
        })
      );
    });

    it('should adjust VR settings for comfort', async () => {
      const comfortSettings = {
        motionSickness: 'high',
        brightness: 0.7,
        contrast: 0.8,
        fieldOfView: 95
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.adjustComfortSettings(comfortSettings);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/vr/accessibility/comfort`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(comfortSettings)
        })
      );
    });
  });
});