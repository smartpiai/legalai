import {
  NegotiationSession,
  NegotiationStrategy,
  NegotiationDashboard,
  NegotiationAnalytics,
  HumanIntervention,
  CreateSessionRequest,
  UpdateStrategyRequest,
  InterventionRequest,
  SessionStatus,
  StrategyValidation,
  RealtimeStatus,
  InterventionResolution,
  OverrideDecision,
  ApprovalRequest,
  NegotiationParticipant,
  NegotiationTimeline,
  NegotiationObjective,
  NegotiationMetrics,
  NashEquilibrium,
  NegotiationPredictions,
  HistoricalComparisons,
  NegotiationAlert,
  NegotiationActivity,
  BatnaConfig
} from '../types/autonomous-negotiation.types';

/**
 * Autonomous Contract Negotiation Service
 * Handles AI-powered contract negotiations with human oversight
 */
export class AutonomousNegotiationService {
  private readonly baseUrl = '/api/v1/negotiation';
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly defaultCacheTtl = 5 * 60 * 1000; // 5 minutes

  /**
   * Session Management Methods
   */

  /**
   * Create a new negotiation session
   */
  async createSession(request: CreateSessionRequest): Promise<NegotiationSession> {
    const response = await this.fetchWithError(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Failed to create session: ${data.error}`);
    }

    const session = data.data;
    this.invalidateSessionCache(session.id);
    return session;
  }

  /**
   * Load an existing negotiation session
   */
  async loadSession(sessionId: string): Promise<NegotiationSession> {
    const cacheKey = `session_${sessionId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const response = await this.fetchWithError(`${this.baseUrl}/sessions/${sessionId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to load session: ${data.error}`);
    }

    const session = data.data;
    this.setCache(cacheKey, session);
    return session;
  }

  /**
   * Update session status
   */
  async updateSessionStatus(sessionId: string, status: SessionStatus): Promise<NegotiationSession> {
    const response = await this.fetchWithError(`${this.baseUrl}/sessions/${sessionId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Failed to update session status: ${data.error}`);
    }

    const session = data.data;
    this.invalidateSessionCache(sessionId);
    return session;
  }

  /**
   * Get all active negotiation sessions
   */
  async getActiveSessions(): Promise<NegotiationSession[]> {
    const cacheKey = 'active_sessions';
    const cached = this.getFromCache(cacheKey, 2 * 60 * 1000); // 2 minute cache
    if (cached) return cached;

    const response = await this.fetchWithError(`${this.baseUrl}/sessions?status=active`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to load active sessions: ${data.error}`);
    }

    const sessions = data.data;
    this.setCache(cacheKey, sessions, 2 * 60 * 1000);
    return sessions;
  }

  /**
   * Get session participants
   */
  async getSessionParticipants(sessionId: string): Promise<NegotiationParticipant[]> {
    const response = await this.fetchWithError(`${this.baseUrl}/sessions/${sessionId}/participants`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to load participants: ${data.error}`);
    }

    return data.data;
  }

  /**
   * Get session timeline
   */
  async getSessionTimeline(sessionId: string): Promise<NegotiationTimeline> {
    const response = await this.fetchWithError(`${this.baseUrl}/sessions/${sessionId}/timeline`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to load timeline: ${data.error}`);
    }

    return data.data;
  }

  /**
   * Strategy Configuration Methods
   */

  /**
   * Create a new negotiation strategy
   */
  async createStrategy(strategy: Omit<NegotiationStrategy, 'id' | 'createdAt'>): Promise<NegotiationStrategy> {
    const response = await this.fetchWithError(`${this.baseUrl}/strategies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(strategy)
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Failed to create strategy: ${data.error}`);
    }

    const createdStrategy = data.data;
    this.invalidateCache('strategy_templates');
    return createdStrategy;
  }

  /**
   * Get available strategy templates
   */
  async getStrategyTemplates(): Promise<NegotiationStrategy[]> {
    const cacheKey = 'strategy_templates';
    const cached = this.getFromCache(cacheKey, 30 * 60 * 1000); // 30 minute cache
    if (cached) return cached;

    const response = await this.fetchWithError(`${this.baseUrl}/strategies/templates`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to load strategy templates: ${data.error}`);
    }

    const templates = data.data;
    this.setCache(cacheKey, templates, 30 * 60 * 1000);
    return templates;
  }

  /**
   * Update strategy configuration
   */
  async updateStrategy(strategyId: string, updates: UpdateStrategyRequest): Promise<NegotiationStrategy> {
    const response = await this.fetchWithError(`${this.baseUrl}/strategies/${strategyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Failed to update strategy: ${data.error}`);
    }

    const strategy = data.data;
    this.invalidateCache(`strategy_${strategyId}`);
    return strategy;
  }

  /**
   * Validate strategy constraints and configuration
   */
  async validateStrategy(strategyId: string): Promise<StrategyValidation> {
    const response = await this.fetchWithError(`${this.baseUrl}/strategies/${strategyId}/validate`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to validate strategy: ${data.error}`);
    }

    return data.data;
  }

  /**
   * Get strategy objectives
   */
  async getStrategyObjectives(strategyId: string): Promise<NegotiationObjective[]> {
    const response = await this.fetchWithError(`${this.baseUrl}/strategies/${strategyId}/objectives`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to load objectives: ${data.error}`);
    }

    return data.data;
  }

  /**
   * Update BATNA configuration
   */
  async updateBatna(strategyId: string, batna: BatnaConfig): Promise<NegotiationStrategy> {
    const response = await this.fetchWithError(`${this.baseUrl}/strategies/${strategyId}/batna`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batna })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Failed to update BATNA: ${data.error}`);
    }

    const strategy = data.data;
    this.invalidateCache(`strategy_${strategyId}`);
    return strategy;
  }

  /**
   * Real-time Dashboard Methods
   */

  /**
   * Get comprehensive dashboard data for a session
   */
  async getDashboard(sessionId: string): Promise<NegotiationDashboard> {
    const cacheKey = `dashboard_${sessionId}`;
    const cached = this.getFromCache(cacheKey, 30 * 1000); // 30 second cache
    if (cached) return cached;

    const response = await this.fetchWithError(`${this.baseUrl}/sessions/${sessionId}/dashboard`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to load dashboard: ${data.error}`);
    }

    const dashboard = data.data;
    this.setCache(cacheKey, dashboard, 30 * 1000);
    return dashboard;
  }

  /**
   * Get real-time status updates
   */
  async getRealtimeStatus(sessionId: string): Promise<RealtimeStatus> {
    const response = await this.fetchWithError(`${this.baseUrl}/sessions/${sessionId}/status`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to load status: ${data.error}`);
    }

    return data.data;
  }

  /**
   * Get trust scores for session participants
   */
  async getTrustScores(sessionId: string): Promise<Record<string, number>> {
    const response = await this.fetchWithError(`${this.baseUrl}/sessions/${sessionId}/trust-scores`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to load trust scores: ${data.error}`);
    }

    return data.data;
  }

  /**
   * Get active alerts for a session
   */
  async getActiveAlerts(sessionId: string): Promise<NegotiationAlert[]> {
    const response = await this.fetchWithError(`${this.baseUrl}/sessions/${sessionId}/alerts`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to load alerts: ${data.error}`);
    }

    return data.data;
  }

  /**
   * Dismiss an alert
   */
  async dismissAlert(sessionId: string, alertId: string): Promise<boolean> {
    const response = await this.fetchWithError(
      `${this.baseUrl}/sessions/${sessionId}/alerts/${alertId}/dismiss`,
      { method: 'PATCH' }
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(`Failed to dismiss alert: ${data.error}`);
    }

    this.invalidateCache(`dashboard_${sessionId}`);
    return true;
  }

  /**
   * Get recent activity for a session
   */
  async getRecentActivity(sessionId: string, limit = 10): Promise<NegotiationActivity[]> {
    const response = await this.fetchWithError(
      `${this.baseUrl}/sessions/${sessionId}/activity?limit=${limit}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to load activity: ${data.error}`);
    }

    return data.data;
  }

  /**
   * Analytics Methods
   */

  /**
   * Get comprehensive analytics for a session
   */
  async getSessionAnalytics(sessionId: string): Promise<NegotiationAnalytics> {
    const cacheKey = `analytics_${sessionId}`;
    const cached = this.getFromCache(cacheKey, 2 * 60 * 1000); // 2 minute cache
    if (cached) return cached;

    const response = await this.fetchWithError(`${this.baseUrl}/sessions/${sessionId}/analytics`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to load analytics: ${data.error}`);
    }

    const analytics = data.data;
    this.setCache(cacheKey, analytics, 2 * 60 * 1000);
    return analytics;
  }

  /**
   * Calculate performance metrics for a session
   */
  async calculateMetrics(sessionId: string): Promise<NegotiationMetrics> {
    const response = await this.fetchWithError(`${this.baseUrl}/sessions/${sessionId}/metrics`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to calculate metrics: ${data.error}`);
    }

    return data.data;
  }

  /**
   * Predict Nash equilibrium for current negotiation state
   */
  async predictNashEquilibrium(sessionId: string): Promise<NashEquilibrium> {
    const response = await this.fetchWithError(`${this.baseUrl}/sessions/${sessionId}/nash-equilibrium`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to predict Nash equilibrium: ${data.error}`);
    }

    return data.data;
  }

  /**
   * Get success predictions and risk analysis
   */
  async getSuccessPredictions(sessionId: string): Promise<NegotiationPredictions> {
    const response = await this.fetchWithError(`${this.baseUrl}/sessions/${sessionId}/predictions`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to load predictions: ${data.error}`);
    }

    return data.data;
  }

  /**
   * Compare session with historical data
   */
  async getHistoricalComparisons(sessionId: string): Promise<HistoricalComparisons> {
    const response = await this.fetchWithError(`${this.baseUrl}/sessions/${sessionId}/historical`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to load historical comparisons: ${data.error}`);
    }

    return data.data;
  }

  /**
   * Human Intervention Methods
   */

  /**
   * Request human intervention
   */
  async requestIntervention(request: InterventionRequest): Promise<HumanIntervention> {
    const response = await this.fetchWithError(`${this.baseUrl}/interventions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Failed to request intervention: ${data.error}`);
    }

    const intervention = data.data;
    this.invalidateCache('pending_interventions');
    return intervention;
  }

  /**
   * Escalate negotiation to human oversight
   */
  async escalateToHuman(sessionId: string, reason: string): Promise<HumanIntervention> {
    const response = await this.fetchWithError(`${this.baseUrl}/sessions/${sessionId}/escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Failed to escalate: ${data.error}`);
    }

    const intervention = data.data;
    this.invalidateSessionCache(sessionId);
    return intervention;
  }

  /**
   * Override AI decision with human judgment
   */
  async overrideAiDecision(sessionId: string, override: OverrideDecision): Promise<boolean> {
    const response = await this.fetchWithError(`${this.baseUrl}/sessions/${sessionId}/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(override)
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(`Failed to override decision: ${data.error}`);
    }

    this.invalidateSessionCache(sessionId);
    return true;
  }

  /**
   * Require human approval for critical decisions
   */
  async requireApproval(sessionId: string, approval: ApprovalRequest): Promise<HumanIntervention> {
    const response = await this.fetchWithError(`${this.baseUrl}/sessions/${sessionId}/require-approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(approval)
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Failed to require approval: ${data.error}`);
    }

    const intervention = data.data;
    this.invalidateCache('pending_interventions');
    return intervention;
  }

  /**
   * Get pending interventions requiring human attention
   */
  async getPendingInterventions(): Promise<HumanIntervention[]> {
    const cacheKey = 'pending_interventions';
    const cached = this.getFromCache(cacheKey, 60 * 1000); // 1 minute cache
    if (cached) return cached;

    const response = await this.fetchWithError(`${this.baseUrl}/interventions?status=pending`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to load pending interventions: ${data.error}`);
    }

    const interventions = data.data;
    this.setCache(cacheKey, interventions, 60 * 1000);
    return interventions;
  }

  /**
   * Resolve human intervention
   */
  async resolveIntervention(interventionId: string, resolution: InterventionResolution): Promise<boolean> {
    const response = await this.fetchWithError(`${this.baseUrl}/interventions/${interventionId}/resolve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resolution)
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(`Failed to resolve intervention: ${data.error}`);
    }

    this.invalidateCache('pending_interventions');
    return true;
  }

  /**
   * Utility Methods
   */

  /**
   * Enhanced fetch with error handling
   */
  private async fetchWithError(url: string, options?: RequestInit): Promise<Response> {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${error}`);
    }
  }

  /**
   * Cache management methods
   */
  private getFromCache<T>(key: string, customTtl?: number): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const ttl = customTtl ?? cached.ttl;
    if (Date.now() - cached.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCache<T>(key: string, data: T, customTtl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: customTtl ?? this.defaultCacheTtl
    });
  }

  private invalidateCache(key: string): void {
    this.cache.delete(key);
  }

  private invalidateSessionCache(sessionId: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(
      key => key.includes(sessionId) || key === 'active_sessions'
    );
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}