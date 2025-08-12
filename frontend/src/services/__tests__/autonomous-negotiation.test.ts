import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AutonomousNegotiationService } from '../autonomous-negotiation.service';
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
  StrategyType,
  InterventionType
} from '../../types/autonomous-negotiation.types';

// Mock fetch globally
global.fetch = vi.fn();

describe('AutonomousNegotiationService', () => {
  let service: AutonomousNegotiationService;
  const mockFetch = fetch as Mock;

  beforeEach(() => {
    service = new AutonomousNegotiationService();
    vi.clearAllMocks();
  });

  describe('Session Management', () => {
    const mockSession: NegotiationSession = {
      id: 'session-1',
      contractId: 'contract-1',
      status: SessionStatus.ACTIVE,
      participants: [
        { id: 'user-1', name: 'Alice Corp', role: 'buyer', isHuman: false },
        { id: 'user-2', name: 'Bob LLC', role: 'seller', isHuman: true }
      ],
      timeline: {
        started: '2024-01-15T10:00:00Z',
        lastActivity: '2024-01-15T11:30:00Z',
        estimatedCompletion: '2024-01-16T10:00:00Z'
      },
      currentRound: 3,
      totalRounds: 10,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T11:30:00Z'
    };

    it('should create a negotiation session', async () => {
      const createRequest: CreateSessionRequest = {
        contractId: 'contract-1',
        participants: ['user-1', 'user-2'],
        strategyId: 'strategy-1',
        maxRounds: 10,
        timeoutMinutes: 1440
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSession })
      });

      const result = await service.createSession(createRequest);

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/negotiation/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createRequest)
      });
      expect(result).toEqual(mockSession);
    });

    it('should handle session creation errors', async () => {
      const createRequest: CreateSessionRequest = {
        contractId: 'contract-1',
        participants: ['user-1'],
        strategyId: 'strategy-1',
        maxRounds: 10,
        timeoutMinutes: 1440
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid participants' })
      });

      await expect(service.createSession(createRequest))
        .rejects.toThrow('Failed to create session: Invalid participants');
    });

    it('should load a negotiation session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSession })
      });

      const result = await service.loadSession('session-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/negotiation/sessions/session-1', undefined);
      expect(result).toEqual(mockSession);
    });

    it('should handle session not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Session not found' })
      });

      await expect(service.loadSession('invalid-id'))
        .rejects.toThrow('Failed to load session: Session not found');
    });

    it('should update session status', async () => {
      const updatedSession = { ...mockSession, status: SessionStatus.PAUSED };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: updatedSession })
      });

      const result = await service.updateSessionStatus('session-1', SessionStatus.PAUSED);

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/negotiation/sessions/session-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: SessionStatus.PAUSED })
      });
      expect(result).toEqual(updatedSession);
    });

    it('should list active sessions', async () => {
      const sessions = [mockSession];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: sessions })
      });

      const result = await service.getActiveSessions();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/negotiation/sessions?status=active', undefined);
      expect(result).toEqual(sessions);
    });

    it('should get session participants', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSession.participants })
      });

      const result = await service.getSessionParticipants('session-1');

      expect(result).toEqual(mockSession.participants);
    });

    it('should get session timeline', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSession.timeline })
      });

      const result = await service.getSessionTimeline('session-1');

      expect(result).toEqual(mockSession.timeline);
    });
  });

  describe('Strategy Configuration', () => {
    const mockStrategy: NegotiationStrategy = {
      id: 'strategy-1',
      name: 'Aggressive Buyer Strategy',
      type: StrategyType.COMPETITIVE,
      objectives: [
        { key: 'price', target: 95000, weight: 0.6, minAcceptable: 90000 },
        { key: 'deliveryDate', target: 30, weight: 0.4, minAcceptable: 45 }
      ],
      constraints: [
        { type: 'budget', value: 100000, isHard: true },
        { type: 'timeline', value: 60, isHard: false }
      ],
      batna: {
        value: 85000,
        description: 'Alternative supplier with higher price but faster delivery',
        confidence: 0.8
      },
      riskTolerance: 0.3,
      concessionPattern: 'linear',
      isActive: true,
      createdAt: '2024-01-15T09:00:00Z'
    };

    it('should create a negotiation strategy', async () => {
      const strategyRequest: Omit<NegotiationStrategy, 'id' | 'createdAt'> = {
        name: 'Test Strategy',
        type: StrategyType.COLLABORATIVE,
        objectives: [{ key: 'price', target: 100000, weight: 1.0, minAcceptable: 90000 }],
        constraints: [],
        batna: { value: 85000, description: 'Alternative', confidence: 0.7 },
        riskTolerance: 0.5,
        concessionPattern: 'exponential',
        isActive: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockStrategy })
      });

      const result = await service.createStrategy(strategyRequest);

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/negotiation/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(strategyRequest)
      });
      expect(result).toEqual(mockStrategy);
    });

    it('should load strategy templates', async () => {
      const templates = [mockStrategy];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: templates })
      });

      const result = await service.getStrategyTemplates();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/negotiation/strategies/templates', undefined);
      expect(result).toEqual(templates);
    });

    it('should update strategy configuration', async () => {
      const updateRequest: UpdateStrategyRequest = {
        riskTolerance: 0.4,
        objectives: [{ key: 'price', target: 98000, weight: 0.8, minAcceptable: 92000 }]
      };

      const updatedStrategy = { ...mockStrategy, ...updateRequest };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: updatedStrategy })
      });

      const result = await service.updateStrategy('strategy-1', updateRequest);

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/negotiation/strategies/strategy-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateRequest)
      });
      expect(result).toEqual(updatedStrategy);
    });

    it('should validate strategy constraints', async () => {
      const validation = {
        isValid: true,
        warnings: ['Risk tolerance is high for conservative strategy'],
        errors: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: validation })
      });

      const result = await service.validateStrategy('strategy-1');

      expect(result).toEqual(validation);
    });

    it('should get strategy objectives', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockStrategy.objectives })
      });

      const result = await service.getStrategyObjectives('strategy-1');

      expect(result).toEqual(mockStrategy.objectives);
    });

    it('should update BATNA configuration', async () => {
      const newBatna = { value: 88000, description: 'Updated alternative', confidence: 0.9 };
      const updatedStrategy = { ...mockStrategy, batna: newBatna };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: updatedStrategy })
      });

      const result = await service.updateBatna('strategy-1', newBatna);

      expect(result.batna).toEqual(newBatna);
    });
  });

  describe('Real-time Dashboard', () => {
    const mockDashboard: NegotiationDashboard = {
      sessionId: 'session-1',
      status: SessionStatus.ACTIVE,
      progress: {
        currentRound: 3,
        totalRounds: 10,
        completionPercentage: 30,
        timeElapsed: 90,
        estimatedTimeRemaining: 210
      },
      trustScores: {
        'user-1': 0.85,
        'user-2': 0.72
      },
      activeAlerts: [
        {
          id: 'alert-1',
          type: 'warning',
          message: 'Negotiation progress slower than expected',
          timestamp: '2024-01-15T11:30:00Z',
          severity: 'medium'
        }
      ],
      recentActivity: [
        {
          timestamp: '2024-01-15T11:25:00Z',
          actor: 'user-1',
          action: 'counter_offer',
          description: 'Submitted counter-offer for price: $97,000'
        }
      ],
      lastUpdated: '2024-01-15T11:30:00Z'
    };

    it('should get dashboard data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockDashboard })
      });

      const result = await service.getDashboard('session-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/negotiation/sessions/session-1/dashboard', undefined);
      expect(result).toEqual(mockDashboard);
    });

    it('should get real-time status updates', async () => {
      const status = { status: SessionStatus.ACTIVE, lastActivity: '2024-01-15T11:30:00Z' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: status })
      });

      const result = await service.getRealtimeStatus('session-1');

      expect(result).toEqual(status);
    });

    it('should get trust scores', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockDashboard.trustScores })
      });

      const result = await service.getTrustScores('session-1');

      expect(result).toEqual(mockDashboard.trustScores);
    });

    it('should get active alerts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockDashboard.activeAlerts })
      });

      const result = await service.getActiveAlerts('session-1');

      expect(result).toEqual(mockDashboard.activeAlerts);
    });

    it('should dismiss alert', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await service.dismissAlert('session-1', 'alert-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/negotiation/sessions/session-1/alerts/alert-1/dismiss',
        { method: 'PATCH' }
      );
      expect(result).toBe(true);
    });

    it('should get recent activity', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockDashboard.recentActivity })
      });

      const result = await service.getRecentActivity('session-1', 5);

      expect(result).toEqual(mockDashboard.recentActivity);
    });
  });

  describe('Analytics', () => {
    const mockAnalytics: NegotiationAnalytics = {
      sessionId: 'session-1',
      metrics: {
        avgResponseTime: 15.5,
        totalExchanges: 12,
        concessionRate: 0.15,
        convergenceScore: 0.75,
        efficiencyScore: 0.82
      },
      nashEquilibrium: {
        predicted: { price: 96500, deliveryDays: 35 },
        confidence: 0.78,
        utilityScores: { 'user-1': 0.85, 'user-2': 0.72 }
      },
      predictions: {
        successProbability: 0.85,
        expectedRounds: 7,
        estimatedFinalValue: 96000,
        riskFactors: ['time_pressure', 'competitive_market']
      },
      historicalComparisons: {
        similarDeals: 15,
        avgSuccess: 0.80,
        avgDuration: 145
      },
      generatedAt: '2024-01-15T11:30:00Z'
    };

    it('should get session analytics', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockAnalytics })
      });

      const result = await service.getSessionAnalytics('session-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/negotiation/sessions/session-1/analytics', undefined);
      expect(result).toEqual(mockAnalytics);
    });

    it('should calculate performance metrics', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockAnalytics.metrics })
      });

      const result = await service.calculateMetrics('session-1');

      expect(result).toEqual(mockAnalytics.metrics);
    });

    it('should predict Nash equilibrium', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockAnalytics.nashEquilibrium })
      });

      const result = await service.predictNashEquilibrium('session-1');

      expect(result).toEqual(mockAnalytics.nashEquilibrium);
    });

    it('should get success predictions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockAnalytics.predictions })
      });

      const result = await service.getSuccessPredictions('session-1');

      expect(result).toEqual(mockAnalytics.predictions);
    });

    it('should compare with historical data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockAnalytics.historicalComparisons })
      });

      const result = await service.getHistoricalComparisons('session-1');

      expect(result).toEqual(mockAnalytics.historicalComparisons);
    });
  });

  describe('Human Intervention', () => {
    const mockIntervention: HumanIntervention = {
      id: 'intervention-1',
      sessionId: 'session-1',
      type: InterventionType.ESCALATION,
      reason: 'Negotiation stalled on key terms',
      requestedBy: 'system',
      assignedTo: 'manager-1',
      status: 'pending',
      priority: 'high',
      context: {
        currentOffer: { price: 95000, deliveryDays: 40 },
        counterOffer: { price: 105000, deliveryDays: 25 },
        impasse: ['price_gap_too_large', 'delivery_timeline']
      },
      requestedAt: '2024-01-15T11:30:00Z'
    };

    it('should request human intervention', async () => {
      const interventionRequest: InterventionRequest = {
        sessionId: 'session-1',
        type: InterventionType.ESCALATION,
        reason: 'Negotiation stalled',
        priority: 'high',
        context: { impasse: ['price_gap_too_large'] }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockIntervention })
      });

      const result = await service.requestIntervention(interventionRequest);

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/negotiation/interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(interventionRequest)
      });
      expect(result).toEqual(mockIntervention);
    });

    it('should escalate to human oversight', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockIntervention })
      });

      const result = await service.escalateToHuman('session-1', 'Deadlock reached');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/negotiation/sessions/session-1/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Deadlock reached' })
      });
      expect(result).toEqual(mockIntervention);
    });

    it('should override AI decision', async () => {
      const overrideData = {
        decision: 'accept_offer',
        reason: 'Strategic business decision',
        newTerms: { price: 97000 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: overrideData })
      });

      const result = await service.overrideAiDecision('session-1', overrideData);

      expect(result).toBe(true);
    });

    it('should require human approval', async () => {
      const approvalRequest = {
        action: 'accept_final_offer',
        terms: { price: 96000, deliveryDays: 35 },
        rationale: 'Within acceptable parameters'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockIntervention })
      });

      const result = await service.requireApproval('session-1', approvalRequest);

      expect(result).toEqual(mockIntervention);
    });

    it('should get pending interventions', async () => {
      const interventions = [mockIntervention];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: interventions })
      });

      const result = await service.getPendingInterventions();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/negotiation/interventions?status=pending', undefined);
      expect(result).toEqual(interventions);
    });

    it('should resolve intervention', async () => {
      const resolution = {
        decision: 'approved',
        notes: 'Approved with minor adjustments',
        adjustments: { price: 96500 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await service.resolveIntervention('intervention-1', resolution);

      expect(result).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.loadSession('session-1'))
        .rejects.toThrow('Network error');
    });

    it('should handle invalid JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      await expect(service.loadSession('session-1'))
        .rejects.toThrow('Invalid JSON');
    });

    it('should handle server errors with proper messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' })
      });

      await expect(service.loadSession('session-1'))
        .rejects.toThrow('Failed to load session: Internal server error');
    });
  });

  describe('Cache Management', () => {
    it('should cache dashboard data', async () => {
      const mockDashboard: NegotiationDashboard = {
        sessionId: 'session-1',
        status: SessionStatus.ACTIVE,
        progress: { currentRound: 1, totalRounds: 10, completionPercentage: 10, timeElapsed: 30, estimatedTimeRemaining: 270 },
        trustScores: {},
        activeAlerts: [],
        recentActivity: [],
        lastUpdated: '2024-01-15T11:30:00Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockDashboard })
      });

      // First call should hit the API
      const result1 = await service.getDashboard('session-1');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await service.getDashboard('session-1');
      expect(mockFetch).toHaveBeenCalledTimes(1); // Should not increase
      expect(result1).toEqual(result2);
    });

    it('should invalidate cache after updates', async () => {
      const mockSession: NegotiationSession = {
        id: 'session-1',
        contractId: 'contract-1',
        status: SessionStatus.ACTIVE,
        participants: [],
        timeline: { started: '2024-01-15T10:00:00Z', lastActivity: '2024-01-15T11:30:00Z', estimatedCompletion: '2024-01-16T10:00:00Z' },
        currentRound: 1,
        totalRounds: 10,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T11:30:00Z'
      };

      // Load session (should cache)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSession })
      });
      await service.loadSession('session-1');

      // Update session (should invalidate cache)
      const updatedSession = { ...mockSession, status: SessionStatus.PAUSED };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: updatedSession })
      });
      await service.updateSessionStatus('session-1', SessionStatus.PAUSED);

      // Load session again (should hit API again)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: updatedSession })
      });
      const result = await service.loadSession('session-1');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.status).toBe(SessionStatus.PAUSED);
    });

    it('should clear all cache', () => {
      service.clearCache();
      // Cache should be empty - subsequent calls should hit API
      expect(service['cache'].size).toBe(0);
    });
  });
});