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
  OptimizationSettings,
  ApiResponse,
  RevolutionaryError
} from '../types/revolutionary-features.types';

export interface VRSessionOptions {
  requiredFeatures?: string[];
  optionalFeatures?: string[];
}

export interface DeviceCalibrationData {
  height: number;
  playArea: { width: number; height: number };
  trackingSpace: 'room-scale' | 'standing' | 'seated';
}

export interface ControllerState {
  position: Vector3D;
  rotation: Quaternion;
  buttons: VRButton[];
  touchpad?: TouchpadData;
}

export interface ControllerInput {
  controllerId: string;
  inputType: 'button' | 'touchpad' | 'trigger';
  buttonId?: string;
  value: number;
  timestamp: number;
}

export interface HapticData {
  intensity: number;
  duration: number;
  pattern: 'pulse' | 'continuous' | 'buzz' | 'tap';
}

export interface GestureRecognitionResult {
  gesture: GestureType;
  confidence: number;
  description: string;
}

export interface GestureCommand {
  gesture: GestureType;
  targetObject?: string;
  action: string;
}

export interface GazeInteraction {
  targetObject: string;
  gazeDirection: Vector3D;
  focusPoint: Vector3D;
  duration: number;
  action: string;
}

export interface VoiceConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
}

export interface VoiceCommand {
  text: string;
  confidence: number;
  intent: string;
  entities: Record<string, unknown>;
}

export interface VoiceCommandResult {
  understood: boolean;
  action: string;
  parameters: Record<string, unknown>;
}

export interface CustomVoiceCommand {
  phrase: string;
  action: string;
}

export interface SpatialUIData {
  type: 'panel' | 'button' | 'slider' | 'menu' | 'document' | 'hologram';
  transform: Transform3D;
  size: Vector3D;
  content: UIContent;
  interactions: UIInteraction[];
}

export interface UIInteractionData {
  uiId: string;
  interactionType: string;
  inputSource: 'controller' | 'hand' | 'gaze' | 'voice';
  position: Vector3D;
  timestamp: number;
}

export interface Document3DData {
  documentId: string;
  position: Vector3D;
  size: Vector3D;
  pages: number;
  currentPage: number;
}

export interface Document3DResult {
  id: string;
  documentId: string;
  position: Vector3D;
  size: Vector3D;
  pages: number;
  currentPage: number;
  meshId: string;
}

export interface DocumentManipulation {
  action: 'move' | 'rotate' | 'scale' | 'flip_page';
  position?: Vector3D;
  rotation?: Quaternion;
  scale?: Vector3D;
  page?: number;
  animation?: {
    duration: number;
    easing: string;
  };
}

export interface DocumentHighlight {
  page: number;
  startPosition: { x: number; y: number };
  endPosition: { x: number; y: number };
  color: string;
  opacity: number;
}

export interface Annotation3DData {
  position: Vector3D;
  content: string;
  type: 'comment' | 'highlight' | 'warning' | 'suggestion';
  author: string;
}

export interface Annotation3DResult {
  id: string;
  position: Vector3D;
  content: string;
  type: string;
  author: string;
  createdAt: Date;
}

export interface AccessibilitySettings {
  largeText: boolean;
  highContrast: boolean;
  voiceOutput: boolean;
  reducedMotion: boolean;
}

export interface ComfortSettings {
  motionSickness: 'low' | 'medium' | 'high';
  brightness: number;
  contrast: number;
  fieldOfView: number;
}

export class VRInterfaceService {
  private baseUrl: string;
  private authToken: string;
  private xrSession: XRSession | null = null;
  private xrReferenceSpace: XRReferenceSpace | null = null;
  private animationFrameId: number | null = null;
  private performanceMonitoringActive = false;
  private performanceCallback: ((metrics: PerformanceMetrics) => void) | null = null;

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

      return data.success ? data.data : data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred');
    }
  }

  // VR Session Management
  async isVRSupported(): Promise<boolean> {
    try {
      if (!navigator.xr) {
        return false;
      }
      return await navigator.xr.isSessionSupported('immersive-vr');
    } catch (error) {
      return false;
    }
  }

  async isARSupported(): Promise<boolean> {
    try {
      if (!navigator.xr) {
        return false;
      }
      return await navigator.xr.isSessionSupported('immersive-ar');
    } catch (error) {
      return false;
    }
  }

  async startVRSession(options: VRSessionOptions = {}): Promise<VRSession> {
    try {
      if (!navigator.xr) {
        throw new Error('WebXR not supported');
      }

      const sessionOptions: XRSessionInit = {
        requiredFeatures: options.requiredFeatures || ['local-floor'],
        optionalFeatures: options.optionalFeatures || ['hand-tracking', 'eye-tracking'],
      };

      this.xrSession = await navigator.xr.requestSession('immersive-vr', sessionOptions);
      this.xrReferenceSpace = await this.xrSession.requestReferenceSpace('local-floor');

      // Setup event listeners
      this.xrSession.addEventListener('end', this.onSessionEnd.bind(this));
      this.xrSession.addEventListener('inputsourceschange', this.onInputSourcesChange.bind(this));

      // Start render loop
      this.startRenderLoop();

      // Create session on backend
      const sessionData = {
        deviceInfo: await this.detectDevice(),
        startTime: new Date(),
      };

      return this.makeRequest<VRSession>('/vr/sessions/start', {
        method: 'POST',
        body: JSON.stringify(sessionData),
      });
    } catch (error) {
      throw new Error(`Failed to start VR session: ${error}`);
    }
  }

  async endVRSession(sessionId: string): Promise<void> {
    try {
      if (this.xrSession) {
        await this.xrSession.end();
      }

      await this.makeRequest<void>(`/vr/sessions/${sessionId}/end`, {
        method: 'POST',
      });
    } catch (error) {
      throw new Error(`Failed to end VR session: ${error}`);
    }
  }

  async getCurrentSession(): Promise<VRSession> {
    return this.makeRequest<VRSession>('/vr/sessions/current');
  }

  async getDeviceInfo(): Promise<VRDevice> {
    return this.makeRequest<VRDevice>('/vr/device/info');
  }

  async calibrateDevice(calibrationData: DeviceCalibrationData): Promise<void> {
    await this.makeRequest<void>('/vr/device/calibrate', {
      method: 'POST',
      body: JSON.stringify(calibrationData),
    });
  }

  private async detectDevice(): Promise<VRDevice> {
    // Mock device detection - in real implementation, this would query the actual VR device
    return {
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
        supports6DOF: true,
      },
    };
  }

  private onSessionEnd(): void {
    this.xrSession = null;
    this.xrReferenceSpace = null;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private onInputSourcesChange(event: XRInputSourceChangeEvent): void {
    // Handle controller connection/disconnection
    console.log('Input sources changed:', event);
  }

  private startRenderLoop(): void {
    if (!this.xrSession) return;

    const renderFrame = (time: number, frame: XRFrame) => {
      if (!this.xrSession) return;

      // Update controllers, hand tracking, eye tracking, etc.
      this.updateInputSources(frame);

      // Update performance monitoring if active
      if (this.performanceMonitoringActive && this.performanceCallback) {
        this.updatePerformanceMetrics();
      }

      this.animationFrameId = this.xrSession.requestAnimationFrame(renderFrame);
    };

    this.animationFrameId = this.xrSession.requestAnimationFrame(renderFrame);
  }

  private updateInputSources(frame: XRFrame): void {
    if (!this.xrSession || !this.xrReferenceSpace) return;

    for (const inputSource of this.xrSession.inputSources) {
      const pose = frame.getPose(inputSource.targetRaySpace, this.xrReferenceSpace);
      if (pose) {
        // Update controller state
        this.updateControllerFromInputSource(inputSource, pose);
      }
    }
  }

  private updateControllerFromInputSource(inputSource: XRInputSource, pose: XRPose): void {
    const controller: VRController = {
      id: inputSource.handedness || 'unknown',
      hand: inputSource.handedness === 'left' ? 'left' : 'right',
      position: {
        x: pose.transform.position.x,
        y: pose.transform.position.y,
        z: pose.transform.position.z,
      },
      rotation: {
        x: pose.transform.orientation.x,
        y: pose.transform.orientation.y,
        z: pose.transform.orientation.z,
        w: pose.transform.orientation.w,
      },
      buttons: this.extractButtons(inputSource.gamepad),
      isConnected: true,
    };

    // Send controller update to backend
    this.updateControllerState(controller.id, {
      position: controller.position,
      rotation: controller.rotation,
      buttons: controller.buttons,
      touchpad: controller.touchpad,
    }).catch(console.error);
  }

  private extractButtons(gamepad: Gamepad | undefined): VRButton[] {
    if (!gamepad) return [];

    return Array.from(gamepad.buttons).map((button, index) => ({
      id: `button-${index}`,
      name: this.getButtonName(index),
      isPressed: button.pressed,
      isPrimary: index === 0, // Usually trigger is primary
      value: button.value,
    }));
  }

  private getButtonName(index: number): string {
    const buttonNames = ['Trigger', 'Grip', 'Touchpad', 'Menu', 'System'];
    return buttonNames[index] || `Button ${index}`;
  }

  // Controller Management
  async getControllers(): Promise<VRController[]> {
    return this.makeRequest<VRController[]>('/vr/controllers');
  }

  async updateControllerState(controllerId: string, state: ControllerState): Promise<void> {
    await this.makeRequest<void>(`/vr/controllers/${controllerId}/state`, {
      method: 'PUT',
      body: JSON.stringify(state),
    });
  }

  async handleControllerInput(inputData: ControllerInput): Promise<void> {
    await this.makeRequest<void>('/vr/input/controller', {
      method: 'POST',
      body: JSON.stringify(inputData),
    });
  }

  async enableHapticFeedback(controllerId: string, hapticData: HapticData): Promise<void> {
    await this.makeRequest<void>(`/vr/controllers/${controllerId}/haptic`, {
      method: 'POST',
      body: JSON.stringify(hapticData),
    });
  }

  // Hand Tracking
  async enableHandTracking(): Promise<void> {
    await this.makeRequest<void>('/vr/tracking/hands/enable', {
      method: 'POST',
    });
  }

  async disableHandTracking(): Promise<void> {
    await this.makeRequest<void>('/vr/tracking/hands/disable', {
      method: 'POST',
    });
  }

  async getHandTrackingData(): Promise<HandTrackingData> {
    return this.makeRequest<HandTrackingData>('/vr/tracking/hands/data');
  }

  async recognizeGesture(handData: HandData): Promise<GestureRecognitionResult> {
    return this.makeRequest<GestureRecognitionResult>('/vr/tracking/hands/gesture', {
      method: 'POST',
      body: JSON.stringify(handData),
    });
  }

  async handleGestureCommand(command: GestureCommand): Promise<void> {
    await this.makeRequest<void>('/vr/input/gesture', {
      method: 'POST',
      body: JSON.stringify(command),
    });
  }

  // Eye Tracking
  async enableEyeTracking(): Promise<void> {
    await this.makeRequest<void>('/vr/tracking/eyes/enable', {
      method: 'POST',
    });
  }

  async disableEyeTracking(): Promise<void> {
    await this.makeRequest<void>('/vr/tracking/eyes/disable', {
      method: 'POST',
    });
  }

  async getEyeTrackingData(): Promise<EyeTrackingData> {
    return this.makeRequest<EyeTrackingData>('/vr/tracking/eyes/data');
  }

  async handleGazeInteraction(gazeData: GazeInteraction): Promise<void> {
    await this.makeRequest<void>('/vr/input/gaze', {
      method: 'POST',
      body: JSON.stringify(gazeData),
    });
  }

  // Voice Commands
  async enableVoiceRecognition(config: VoiceConfig): Promise<void> {
    await this.makeRequest<void>('/vr/voice/enable', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async disableVoiceRecognition(): Promise<void> {
    await this.makeRequest<void>('/vr/voice/disable', {
      method: 'POST',
    });
  }

  async processVoiceCommand(command: VoiceCommand): Promise<VoiceCommandResult> {
    return this.makeRequest<VoiceCommandResult>('/vr/voice/command', {
      method: 'POST',
      body: JSON.stringify(command),
    });
  }

  async registerVoiceCommands(commands: CustomVoiceCommand[]): Promise<void> {
    await this.makeRequest<void>('/vr/voice/commands', {
      method: 'POST',
      body: JSON.stringify({ commands }),
    });
  }

  // Spatial UI Management
  async createSpatialUI(uiData: SpatialUIData): Promise<SpatialUI> {
    return this.makeRequest<SpatialUI>('/vr/ui/create', {
      method: 'POST',
      body: JSON.stringify(uiData),
    });
  }

  async updateSpatialUI(uiId: string, updates: Partial<SpatialUIData>): Promise<void> {
    await this.makeRequest<void>(`/vr/ui/${uiId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteSpatialUI(uiId: string): Promise<void> {
    await this.makeRequest<void>(`/vr/ui/${uiId}`, {
      method: 'DELETE',
    });
  }

  async showSpatialUI(uiId: string): Promise<void> {
    await this.makeRequest<void>(`/vr/ui/${uiId}/show`, {
      method: 'POST',
    });
  }

  async hideSpatialUI(uiId: string): Promise<void> {
    await this.makeRequest<void>(`/vr/ui/${uiId}/hide`, {
      method: 'POST',
    });
  }

  async handleUIInteraction(interactionData: UIInteractionData): Promise<void> {
    await this.makeRequest<void>('/vr/ui/interact', {
      method: 'POST',
      body: JSON.stringify(interactionData),
    });
  }

  async getSpatialUIElements(): Promise<SpatialUI[]> {
    return this.makeRequest<SpatialUI[]>('/vr/ui/elements');
  }

  async animateSpatialUI(uiId: string, animation: { property: string; from: any; to: any; duration: number }): Promise<void> {
    await this.makeRequest<void>(`/vr/ui/${uiId}/animate`, {
      method: 'POST',
      body: JSON.stringify(animation),
    });
  }

  // Document Manipulation
  async create3DDocument(documentData: Document3DData): Promise<Document3DResult> {
    return this.makeRequest<Document3DResult>('/vr/documents/create3d', {
      method: 'POST',
      body: JSON.stringify(documentData),
    });
  }

  async manipulateDocument(documentId: string, manipulation: DocumentManipulation): Promise<void> {
    await this.makeRequest<void>(`/vr/documents/${documentId}/manipulate`, {
      method: 'POST',
      body: JSON.stringify(manipulation),
    });
  }

  async highlightDocumentText(documentId: string, highlightData: DocumentHighlight): Promise<void> {
    await this.makeRequest<void>(`/vr/documents/${documentId}/highlight`, {
      method: 'POST',
      body: JSON.stringify(highlightData),
    });
  }

  async add3DAnnotation(documentId: string, annotationData: Annotation3DData): Promise<Annotation3DResult> {
    return this.makeRequest<Annotation3DResult>(`/vr/documents/${documentId}/annotations`, {
      method: 'POST',
      body: JSON.stringify(annotationData),
    });
  }

  async remove3DAnnotation(documentId: string, annotationId: string): Promise<void> {
    await this.makeRequest<void>(`/vr/documents/${documentId}/annotations/${annotationId}`, {
      method: 'DELETE',
    });
  }

  async get3DDocuments(): Promise<Document3DResult[]> {
    return this.makeRequest<Document3DResult[]>('/vr/documents/3d');
  }

  async close3DDocument(documentId: string): Promise<void> {
    await this.makeRequest<void>(`/vr/documents/${documentId}/close`, {
      method: 'POST',
    });
  }

  async navigate3DDocument(documentId: string, page: number): Promise<void> {
    await this.makeRequest<void>(`/vr/documents/${documentId}/navigate`, {
      method: 'POST',
      body: JSON.stringify({ page }),
    });
  }

  // Performance Optimization
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return this.makeRequest<PerformanceMetrics>('/vr/performance/metrics');
  }

  async applyOptimizations(optimizations: OptimizationSettings): Promise<void> {
    await this.makeRequest<void>('/vr/performance/optimize', {
      method: 'POST',
      body: JSON.stringify(optimizations),
    });
  }

  async adjustRenderQuality(quality: 'low' | 'medium' | 'high' | 'ultra'): Promise<void> {
    await this.makeRequest<void>('/vr/performance/quality', {
      method: 'PUT',
      body: JSON.stringify({ quality }),
    });
  }

  async startPerformanceMonitoring(callback: (metrics: PerformanceMetrics) => void): Promise<void> {
    this.performanceCallback = callback;
    this.performanceMonitoringActive = true;

    await this.makeRequest<void>('/vr/performance/monitor/start', {
      method: 'POST',
    });
  }

  async stopPerformanceMonitoring(): Promise<void> {
    this.performanceMonitoringActive = false;
    this.performanceCallback = null;

    await this.makeRequest<void>('/vr/performance/monitor/stop', {
      method: 'POST',
    });
  }

  private async updatePerformanceMetrics(): Promise<void> {
    if (!this.performanceCallback) return;

    try {
      const metrics = await this.getPerformanceMetrics();
      this.performanceCallback(metrics);
    } catch (error) {
      console.error('Failed to update performance metrics:', error);
    }
  }

  async optimizeForDevice(deviceType: string): Promise<void> {
    await this.makeRequest<void>('/vr/performance/optimize-device', {
      method: 'POST',
      body: JSON.stringify({ deviceType }),
    });
  }

  async enableAdaptiveQuality(): Promise<void> {
    await this.makeRequest<void>('/vr/performance/adaptive-quality/enable', {
      method: 'POST',
    });
  }

  async disableAdaptiveQuality(): Promise<void> {
    await this.makeRequest<void>('/vr/performance/adaptive-quality/disable', {
      method: 'POST',
    });
  }

  // Accessibility Features
  async enableAccessibilityMode(settings: AccessibilitySettings): Promise<void> {
    await this.makeRequest<void>('/vr/accessibility/enable', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  async disableAccessibilityMode(): Promise<void> {
    await this.makeRequest<void>('/vr/accessibility/disable', {
      method: 'POST',
    });
  }

  async provideVoiceGuidance(text: string): Promise<void> {
    await this.makeRequest<void>('/vr/accessibility/voice-guidance', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async adjustComfortSettings(settings: ComfortSettings): Promise<void> {
    await this.makeRequest<void>('/vr/accessibility/comfort', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async enableMotionSicknessReduction(): Promise<void> {
    await this.makeRequest<void>('/vr/accessibility/motion-sickness/enable', {
      method: 'POST',
    });
  }

  async disableMotionSicknessReduction(): Promise<void> {
    await this.makeRequest<void>('/vr/accessibility/motion-sickness/disable', {
      method: 'POST',
    });
  }

  // Advanced Features
  async createVirtualKeyboard(position: Vector3D): Promise<string> {
    const result = await this.makeRequest<{ id: string }>('/vr/ui/keyboard/create', {
      method: 'POST',
      body: JSON.stringify({ position }),
    });
    return result.id;
  }

  async removeVirtualKeyboard(keyboardId: string): Promise<void> {
    await this.makeRequest<void>(`/vr/ui/keyboard/${keyboardId}/remove`, {
      method: 'DELETE',
    });
  }

  async enableSpatialAudio(): Promise<void> {
    await this.makeRequest<void>('/vr/audio/spatial/enable', {
      method: 'POST',
    });
  }

  async disableSpatialAudio(): Promise<void> {
    await this.makeRequest<void>('/vr/audio/spatial/disable', {
      method: 'POST',
    });
  }

  async captureVRScreenshot(): Promise<{ url: string }> {
    return this.makeRequest<{ url: string }>('/vr/capture/screenshot', {
      method: 'POST',
    });
  }

  async startVRRecording(): Promise<{ recordingId: string }> {
    return this.makeRequest<{ recordingId: string }>('/vr/capture/recording/start', {
      method: 'POST',
    });
  }

  async stopVRRecording(recordingId: string): Promise<{ url: string }> {
    return this.makeRequest<{ url: string }>(`/vr/capture/recording/${recordingId}/stop`, {
      method: 'POST',
    });
  }

  async getVRSessionHistory(): Promise<VRSession[]> {
    return this.makeRequest<VRSession[]>('/vr/sessions/history');
  }

  async exportVRSessionData(sessionId: string, format: 'json' | 'csv' | 'xml'): Promise<{ downloadUrl: string }> {
    return this.makeRequest<{ downloadUrl: string }>(`/vr/sessions/${sessionId}/export`, {
      method: 'POST',
      body: JSON.stringify({ format }),
    });
  }

  // Utility Methods
  transformWorldToLocal(worldPosition: Vector3D, referenceTransform: Transform3D): Vector3D {
    // Simplified transformation - in real implementation would use proper matrix math
    return {
      x: worldPosition.x - referenceTransform.position.x,
      y: worldPosition.y - referenceTransform.position.y,
      z: worldPosition.z - referenceTransform.position.z,
    };
  }

  transformLocalToWorld(localPosition: Vector3D, referenceTransform: Transform3D): Vector3D {
    // Simplified transformation - in real implementation would use proper matrix math
    return {
      x: localPosition.x + referenceTransform.position.x,
      y: localPosition.y + referenceTransform.position.y,
      z: localPosition.z + referenceTransform.position.z,
    };
  }

  calculateDistance(pos1: Vector3D, pos2: Vector3D): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  normalizeQuaternion(quaternion: Quaternion): Quaternion {
    const { x, y, z, w } = quaternion;
    const length = Math.sqrt(x * x + y * y + z * z + w * w);
    
    if (length === 0) {
      return { x: 0, y: 0, z: 0, w: 1 };
    }

    return {
      x: x / length,
      y: y / length,
      z: z / length,
      w: w / length,
    };
  }

  // Cleanup
  async cleanup(): Promise<void> {
    try {
      if (this.performanceMonitoringActive) {
        await this.stopPerformanceMonitoring();
      }

      if (this.xrSession) {
        await this.xrSession.end();
      }

      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      // Cleanup any remaining resources
      await this.makeRequest<void>('/vr/cleanup', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Error during VR cleanup:', error);
    }
  }
}