// Revolutionary Features Types - VR/AR/Metaverse Integration
// Week 47-48 Implementation

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Transform3D {
  position: Vector3D;
  rotation: Quaternion;
  scale: Vector3D;
}

// Legal Metaverse Types
export interface VirtualEnvironment {
  id: string;
  name: string;
  type: 'courtroom' | 'office' | 'library' | 'negotiation' | 'presentation';
  maxParticipants: number;
  isActive: boolean;
  settings: EnvironmentSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvironmentSettings {
  lighting: 'natural' | 'artificial' | 'dramatic';
  ambience: 'silent' | 'office' | 'courtroom' | 'library';
  accessibility: AccessibilitySettings;
  privacy: PrivacyLevel;
}

export interface AccessibilitySettings {
  textToSpeech: boolean;
  subtitles: boolean;
  highContrast: boolean;
  largeText: boolean;
  voiceCommands: boolean;
}

export type PrivacyLevel = 'public' | 'private' | 'confidential' | 'top-secret';

export interface VirtualAvatar {
  id: string;
  userId: string;
  name: string;
  appearance: AvatarAppearance;
  position: Transform3D;
  animations: AvatarAnimation[];
  isActive: boolean;
}

export interface AvatarAppearance {
  model: string;
  textures: string[];
  accessories: string[];
  clothing: string[];
  customizations: Record<string, unknown>;
}

export interface AvatarAnimation {
  name: string;
  type: 'idle' | 'gesture' | 'expression' | 'movement';
  duration: number;
  loop: boolean;
}

export interface VirtualSession {
  id: string;
  environmentId: string;
  participants: VirtualParticipant[];
  startTime: Date;
  endTime?: Date;
  status: 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  recording?: SessionRecording;
}

export interface VirtualParticipant {
  userId: string;
  avatarId: string;
  role: 'client' | 'attorney' | 'judge' | 'witness' | 'observer';
  permissions: ParticipantPermissions;
  joinedAt: Date;
  leftAt?: Date;
}

export interface ParticipantPermissions {
  canSpeak: boolean;
  canMove: boolean;
  canManipulateObjects: boolean;
  canRecord: boolean;
  canInviteOthers: boolean;
}

export interface SessionRecording {
  id: string;
  format: 'vr' | '360video' | '3d' | 'traditional';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  fileSize: number;
  duration: number;
  url: string;
}

// VR Interface Types
export interface VRSession {
  id: string;
  deviceInfo: VRDevice;
  controllers: VRController[];
  eyeTracking?: EyeTrackingData;
  handTracking?: HandTrackingData;
  isConnected: boolean;
  startTime: Date;
}

export interface VRDevice {
  type: 'oculus' | 'vive' | 'index' | 'pico' | 'quest' | 'generic';
  model: string;
  resolution: { width: number; height: number };
  refreshRate: number;
  fov: number;
  capabilities: VRCapabilities;
}

export interface VRCapabilities {
  hasHandTracking: boolean;
  hasEyeTracking: boolean;
  hasHapticFeedback: boolean;
  hasVoiceInput: boolean;
  supports6DOF: boolean;
}

export interface VRController {
  id: string;
  hand: 'left' | 'right';
  position: Vector3D;
  rotation: Quaternion;
  buttons: VRButton[];
  touchpad?: TouchpadData;
  isConnected: boolean;
}

export interface VRButton {
  id: string;
  name: string;
  isPressed: boolean;
  isPrimary: boolean;
  value: number; // 0-1 for analog buttons
}

export interface TouchpadData {
  position: { x: number; y: number };
  isTouched: boolean;
  isPressed: boolean;
}

export interface EyeTrackingData {
  leftEye: EyeData;
  rightEye: EyeData;
  gazeDirection: Vector3D;
  focusPoint: Vector3D;
  pupilDilation: number;
}

export interface EyeData {
  position: Vector3D;
  rotation: Quaternion;
  isOpen: boolean;
  blinkRate: number;
}

export interface HandTrackingData {
  leftHand: HandData;
  rightHand: HandData;
}

export interface HandData {
  position: Vector3D;
  rotation: Quaternion;
  fingers: FingerData[];
  gesture: GestureType;
  confidence: number;
}

export interface FingerData {
  name: 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
  joints: Vector3D[];
  isBent: boolean;
  flexion: number; // 0-1
}

export type GestureType = 'open' | 'fist' | 'point' | 'pinch' | 'grab' | 'thumbsUp' | 'peace' | 'custom';

export interface SpatialUI {
  id: string;
  type: 'panel' | 'button' | 'slider' | 'menu' | 'document' | 'hologram';
  transform: Transform3D;
  size: Vector3D;
  content: UIContent;
  interactions: UIInteraction[];
  isVisible: boolean;
}

export interface UIContent {
  text?: string;
  html?: string;
  texture?: string;
  model?: string;
  data?: unknown;
}

export interface UIInteraction {
  type: 'click' | 'hover' | 'drag' | 'pinch' | 'gaze' | 'voice';
  callback: string;
  parameters?: Record<string, unknown>;
}

// Holographic Visualization Types
export interface Hologram {
  id: string;
  name: string;
  type: HologramType;
  data: HologramData;
  visualization: VisualizationSettings;
  transform: Transform3D;
  isVisible: boolean;
  createdAt: Date;
}

export type HologramType = 'contract' | 'timeline' | 'relationship' | 'evidence' | 'data' | 'document';

export interface HologramData {
  source: string;
  format: 'json' | 'xml' | 'csv' | 'pdf' | 'model';
  content: unknown;
  metadata: Record<string, unknown>;
}

export interface VisualizationSettings {
  renderMode: 'wireframe' | 'solid' | 'transparent' | 'particles';
  color: string;
  opacity: number;
  animation: AnimationSettings;
  lighting: LightingSettings;
}

export interface AnimationSettings {
  type: 'static' | 'rotate' | 'pulse' | 'float' | 'custom';
  speed: number;
  loop: boolean;
  autoPlay: boolean;
}

export interface LightingSettings {
  ambient: number;
  directional: number;
  shadows: boolean;
  reflections: boolean;
}

export interface ContractVisualization {
  contractId: string;
  hologramId: string;
  sections: ContractSection3D[];
  relationships: ContractRelationship3D[];
  annotations: Annotation3D[];
  metrics: VisualizationMetrics;
}

export interface ContractSection3D {
  id: string;
  title: string;
  content: string;
  position: Vector3D;
  size: Vector3D;
  importance: number; // 0-1
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  color: string;
}

export interface ContractRelationship3D {
  id: string;
  fromSectionId: string;
  toSectionId: string;
  type: 'depends' | 'conflicts' | 'references' | 'modifies';
  strength: number; // 0-1
  visualization: 'line' | 'curve' | 'particle' | 'glow';
}

export interface Annotation3D {
  id: string;
  sectionId: string;
  type: 'comment' | 'highlight' | 'warning' | 'suggestion';
  content: string;
  author: string;
  position: Vector3D;
  createdAt: Date;
}

export interface VisualizationMetrics {
  complexity: number;
  renderTime: number;
  polygonCount: number;
  memoryUsage: number;
  performance: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface LegalTimeline3D {
  id: string;
  caseId: string;
  events: TimelineEvent3D[];
  visualization: TimelineVisualization;
  navigation: TimelineNavigation;
}

export interface TimelineEvent3D {
  id: string;
  date: Date;
  title: string;
  description: string;
  type: 'filing' | 'hearing' | 'decision' | 'deadline' | 'milestone';
  importance: number;
  position: Vector3D;
  documents: string[];
  participants: string[];
}

export interface TimelineVisualization {
  layout: 'linear' | 'spiral' | 'tree' | 'network';
  scale: 'day' | 'week' | 'month' | 'year';
  style: 'modern' | 'classic' | 'minimal' | 'detailed';
  colors: Record<string, string>;
}

export interface TimelineNavigation {
  currentPosition: Date;
  viewRange: { start: Date; end: Date };
  zoomLevel: number;
  autoPlay: boolean;
  playbackSpeed: number;
}

export interface EvidenceReconstruction {
  id: string;
  caseId: string;
  scenario: string;
  objects: Evidence3DObject[];
  environment: EvidenceEnvironment;
  simulation: SimulationSettings;
}

export interface Evidence3DObject {
  id: string;
  name: string;
  type: 'person' | 'vehicle' | 'weapon' | 'document' | 'location' | 'item';
  model: string;
  transform: Transform3D;
  properties: Record<string, unknown>;
  timeline: ObjectTimelineEvent[];
}

export interface ObjectTimelineEvent {
  timestamp: Date;
  action: string;
  transform: Transform3D;
  properties: Record<string, unknown>;
}

export interface EvidenceEnvironment {
  name: string;
  type: 'indoor' | 'outdoor' | 'vehicle' | 'mixed';
  lighting: 'day' | 'night' | 'dawn' | 'dusk' | 'artificial';
  weather?: 'clear' | 'rain' | 'snow' | 'fog';
  model: string;
}

export interface SimulationSettings {
  physics: boolean;
  realTime: boolean;
  accuracy: 'low' | 'medium' | 'high' | 'forensic';
  recordingEnabled: boolean;
  playbackSpeed: number;
}

// Performance and Optimization Types
export interface PerformanceMetrics {
  frameRate: number;
  renderTime: number;
  memoryUsage: number;
  cpuUsage: number;
  gpuUsage: number;
  networkLatency: number;
  warnings: PerformanceWarning[];
}

export interface PerformanceWarning {
  type: 'memory' | 'performance' | 'network' | 'compatibility';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

export interface OptimizationSettings {
  levelOfDetail: boolean;
  culling: boolean;
  compression: boolean;
  caching: boolean;
  streaming: boolean;
  quality: 'low' | 'medium' | 'high' | 'ultra';
}

// Event Types
export interface VREvent {
  type: string;
  timestamp: Date;
  sessionId: string;
  userId: string;
  data: Record<string, unknown>;
}

export interface MetaverseEvent extends VREvent {
  environmentId: string;
  participants: string[];
}

export interface HolographicEvent extends VREvent {
  hologramId: string;
  interactionType: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Configuration Types
export interface RevolutionaryFeaturesConfig {
  metaverse: MetaverseConfig;
  vr: VRConfig;
  holographic: HolographicConfig;
}

export interface MetaverseConfig {
  maxEnvironments: number;
  maxParticipants: number;
  recordingEnabled: boolean;
  qualitySettings: OptimizationSettings;
}

export interface VRConfig {
  supportedDevices: string[];
  minRequirements: VRRequirements;
  features: VRFeatures;
}

export interface VRRequirements {
  minFrameRate: number;
  minResolution: { width: number; height: number };
  minMemory: number;
  requiredCapabilities: string[];
}

export interface VRFeatures {
  handTracking: boolean;
  eyeTracking: boolean;
  voiceCommands: boolean;
  hapticFeedback: boolean;
  spatialAudio: boolean;
}

export interface HolographicConfig {
  maxHolograms: number;
  maxComplexity: number;
  renderQuality: 'low' | 'medium' | 'high' | 'ultra';
  cachingEnabled: boolean;
}

// Error Types
export interface RevolutionaryError extends Error {
  code: string;
  type: 'vr' | 'metaverse' | 'holographic' | 'network' | 'hardware';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  context?: Record<string, unknown>;
}