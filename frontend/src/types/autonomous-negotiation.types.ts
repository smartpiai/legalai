// Types for Autonomous Contract Negotiation System

export enum SessionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ESCALATED = 'escalated'
}

export enum StrategyType {
  COMPETITIVE = 'competitive',
  COLLABORATIVE = 'collaborative',
  ACCOMMODATING = 'accommodating',
  AVOIDING = 'avoiding',
  COMPROMISING = 'compromising'
}

export enum InterventionType {
  ESCALATION = 'escalation',
  APPROVAL = 'approval',
  OVERRIDE = 'override',
  GUIDANCE = 'guidance'
}

export interface NegotiationParticipant {
  id: string;
  name: string;
  role: 'buyer' | 'seller' | 'mediator';
  isHuman: boolean;
}

export interface NegotiationTimeline {
  started: string;
  lastActivity: string;
  estimatedCompletion?: string;
}

export interface NegotiationSession {
  id: string;
  contractId: string;
  status: SessionStatus;
  participants: NegotiationParticipant[];
  timeline: NegotiationTimeline;
  currentRound: number;
  totalRounds: number;
  createdAt: string;
  updatedAt: string;
}

export interface NegotiationObjective {
  key: string;
  target: number;
  weight: number;
  minAcceptable: number;
}

export interface NegotiationConstraint {
  type: string;
  value: number;
  isHard: boolean;
}

export interface BatnaConfig {
  value: number;
  description: string;
  confidence: number;
}

export interface NegotiationStrategy {
  id: string;
  name: string;
  type: StrategyType;
  objectives: NegotiationObjective[];
  constraints: NegotiationConstraint[];
  batna: BatnaConfig;
  riskTolerance: number;
  concessionPattern: 'linear' | 'exponential' | 'step';
  isActive: boolean;
  createdAt: string;
}

export interface NegotiationProgress {
  currentRound: number;
  totalRounds: number;
  completionPercentage: number;
  timeElapsed: number;
  estimatedTimeRemaining: number;
}

export interface NegotiationAlert {
  id: string;
  type: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
}

export interface NegotiationActivity {
  timestamp: string;
  actor: string;
  action: string;
  description: string;
}

export interface NegotiationDashboard {
  sessionId: string;
  status: SessionStatus;
  progress: NegotiationProgress;
  trustScores: Record<string, number>;
  activeAlerts: NegotiationAlert[];
  recentActivity: NegotiationActivity[];
  lastUpdated: string;
}

export interface NegotiationMetrics {
  avgResponseTime: number;
  totalExchanges: number;
  concessionRate: number;
  convergenceScore: number;
  efficiencyScore: number;
}

export interface NashEquilibrium {
  predicted: Record<string, number>;
  confidence: number;
  utilityScores: Record<string, number>;
}

export interface NegotiationPredictions {
  successProbability: number;
  expectedRounds: number;
  estimatedFinalValue: number;
  riskFactors: string[];
}

export interface HistoricalComparisons {
  similarDeals: number;
  avgSuccess: number;
  avgDuration: number;
}

export interface NegotiationAnalytics {
  sessionId: string;
  metrics: NegotiationMetrics;
  nashEquilibrium: NashEquilibrium;
  predictions: NegotiationPredictions;
  historicalComparisons: HistoricalComparisons;
  generatedAt: string;
}

export interface HumanIntervention {
  id: string;
  sessionId: string;
  type: InterventionType;
  reason: string;
  requestedBy: string;
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  context: Record<string, any>;
  requestedAt: string;
  resolvedAt?: string;
}

// Request/Response Types
export interface CreateSessionRequest {
  contractId: string;
  participants: string[];
  strategyId: string;
  maxRounds: number;
  timeoutMinutes: number;
}

export interface UpdateStrategyRequest {
  name?: string;
  type?: StrategyType;
  objectives?: NegotiationObjective[];
  constraints?: NegotiationConstraint[];
  riskTolerance?: number;
  concessionPattern?: 'linear' | 'exponential' | 'step';
}

export interface InterventionRequest {
  sessionId: string;
  type: InterventionType;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  context: Record<string, any>;
}

export interface StrategyValidation {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

export interface RealtimeStatus {
  status: SessionStatus;
  lastActivity: string;
}

export interface InterventionResolution {
  decision: string;
  notes?: string;
  adjustments?: Record<string, any>;
}

export interface OverrideDecision {
  decision: string;
  reason: string;
  newTerms?: Record<string, any>;
}

export interface ApprovalRequest {
  action: string;
  terms: Record<string, any>;
  rationale: string;
}