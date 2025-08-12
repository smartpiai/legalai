import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PredictiveIntelligenceService } from '../predictive-intelligence.service';
import type {
  MarketTrend,
  RegulatoryPrediction,
  RiskAlert,
  PredictiveAnalytics,
  IntelligenceReport,
  ScenarioSimulation,
  MarketIntelligenceDashboard,
  RiskManagementInterface,
  TrendAnalysisRequest,
  RiskAssessmentRequest,
  ForecastRequest,
  ReportGenerationRequest,
  ScenarioRequest,
  PredictionAccuracy,
  MarketSentiment,
  ComplianceRisk,
  EarlyWarning,
  PatternRecognition,
  TimeSeriesForecast,
  EventCorrelation,
  ExecutiveBriefing,
  AlertConfiguration,
  ImpactModel,
  MitigationStrategy
} from '../../types/predictive-intelligence';

// Mock fetch globally
global.fetch = vi.fn();

describe('PredictiveIntelligenceService', () => {
  let service: PredictiveIntelligenceService;
  const mockApiBase = 'http://localhost:8000';

  beforeEach(() => {
    service = new PredictiveIntelligenceService(mockApiBase);
    vi.clearAllMocks();
    // Clear cache
    (service as any).cache.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Market Intelligence Dashboard Tests
  describe('Market Intelligence Dashboard', () => {
    it('should get market intelligence dashboard', async () => {
      const mockDashboard: MarketIntelligenceDashboard = {
        trends: [
          {
            id: 'trend-1',
            title: 'AI Regulation Trends',
            category: 'regulatory',
            direction: 'increasing',
            confidence: 0.85,
            timeframe: '6-months',
            impact: 'high',
            description: 'AI regulation increasing globally',
            data: [
              { date: '2024-01-01', value: 100, confidence: 0.8 },
              { date: '2024-02-01', value: 120, confidence: 0.85 }
            ]
          }
        ],
        predictions: [
          {
            id: 'pred-1',
            type: 'regulatory_change',
            jurisdiction: 'EU',
            title: 'GDPR Updates Expected',
            confidence: 0.75,
            timeframe: '3-months',
            impact: 'medium',
            description: 'GDPR amendments expected',
            factors: ['political', 'technological'],
            probability: 0.65
          }
        ],
        sentiment: {
          overall: 'neutral',
          score: 0.0,
          categories: {
            regulatory: 'negative',
            market: 'positive',
            technology: 'neutral'
          },
          trends: [
            { period: '2024-01', sentiment: 'positive', score: 0.2 },
            { period: '2024-02', sentiment: 'neutral', score: 0.0 }
          ]
        },
        lastUpdated: '2024-01-15T10:00:00Z'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDashboard
      });

      const result = await service.getMarketIntelligenceDashboard();

      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBase}/api/v1/predictive-intelligence/market-dashboard`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
      expect(result).toEqual(mockDashboard);
    });

    it('should analyze market trends', async () => {
      const request: TrendAnalysisRequest = {
        categories: ['regulatory', 'market'],
        timeframe: '12-months',
        jurisdictions: ['US', 'EU'],
        confidence_threshold: 0.7
      };

      const mockTrends: MarketTrend[] = [
        {
          id: 'trend-2',
          title: 'Data Privacy Regulations',
          category: 'regulatory',
          direction: 'increasing',
          confidence: 0.9,
          timeframe: '12-months',
          impact: 'high',
          description: 'Increasing data privacy requirements',
          data: [
            { date: '2024-01-01', value: 150, confidence: 0.85 },
            { date: '2024-06-01', value: 200, confidence: 0.9 }
          ]
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTrends
      });

      const result = await service.analyzeMarketTrends(request);

      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBase}/api/v1/predictive-intelligence/analyze-trends`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(request)
        })
      );
      expect(result).toEqual(mockTrends);
    });

    it('should get regulatory predictions', async () => {
      const mockPredictions: RegulatoryPrediction[] = [
        {
          id: 'pred-2',
          type: 'new_regulation',
          jurisdiction: 'US',
          title: 'Federal AI Act',
          confidence: 0.8,
          timeframe: '6-months',
          impact: 'high',
          description: 'New federal AI regulation expected',
          factors: ['political', 'technological', 'economic'],
          probability: 0.7
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPredictions
      });

      const result = await service.getRegulatoryPredictions('US', 'high');

      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBase}/api/v1/predictive-intelligence/regulatory-predictions?jurisdiction=US&impact=high`,
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toEqual(mockPredictions);
    });

    it('should analyze market sentiment', async () => {
      const mockSentiment: MarketSentiment = {
        overall: 'positive',
        score: 0.3,
        categories: {
          regulatory: 'neutral',
          market: 'positive',
          technology: 'positive'
        },
        trends: [
          { period: '2024-01', sentiment: 'neutral', score: 0.0 },
          { period: '2024-02', sentiment: 'positive', score: 0.3 }
        ]
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSentiment
      });

      const result = await service.analyzeMarketSentiment(['regulatory', 'market']);

      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBase}/api/v1/predictive-intelligence/market-sentiment`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ categories: ['regulatory', 'market'] })
        })
      );
      expect(result).toEqual(mockSentiment);
    });
  });

  // Risk Management Interface Tests
  describe('Risk Management Interface', () => {
    it('should get risk management interface', async () => {
      const mockInterface: RiskManagementInterface = {
        alerts: [
          {
            id: 'alert-1',
            type: 'compliance_risk',
            severity: 'high',
            title: 'GDPR Compliance Gap',
            description: 'Potential compliance gap detected',
            category: 'regulatory',
            source: 'automated_analysis',
            confidence: 0.85,
            created_at: '2024-01-15T10:00:00Z',
            expires_at: '2024-02-15T10:00:00Z',
            actions: ['review_policies', 'update_procedures'],
            metadata: { jurisdiction: 'EU', regulation: 'GDPR' }
          }
        ],
        warnings: [
          {
            id: 'warning-1',
            type: 'regulatory_change',
            priority: 'medium',
            title: 'Upcoming Regulation Changes',
            description: 'Changes expected in Q2',
            timeline: '3-months',
            impact_areas: ['data_processing', 'consent_management'],
            confidence: 0.7,
            created_at: '2024-01-15T10:00:00Z'
          }
        ],
        patterns: [
          {
            id: 'pattern-1',
            type: 'compliance_trend',
            name: 'Increasing Consent Requirements',
            description: 'Pattern of increasing consent requirements',
            frequency: 'monthly',
            strength: 0.8,
            risk_level: 'medium',
            indicators: ['consent_requests', 'opt_out_rates'],
            last_detected: '2024-01-15T10:00:00Z',
            next_expected: '2024-02-15T10:00:00Z'
          }
        ],
        riskScore: 65,
        lastUpdated: '2024-01-15T10:00:00Z'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockInterface
      });

      const result = await service.getRiskManagementInterface();

      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBase}/api/v1/predictive-intelligence/risk-management`,
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toEqual(mockInterface);
    });

    it('should assess compliance risks', async () => {
      const request: RiskAssessmentRequest = {
        categories: ['regulatory', 'operational'],
        jurisdictions: ['US', 'EU'],
        time_horizon: '6-months',
        include_mitigations: true
      };

      const mockRisks: ComplianceRisk[] = [
        {
          id: 'risk-1',
          category: 'regulatory',
          type: 'compliance_gap',
          title: 'Data Retention Policy Gap',
          description: 'Insufficient data retention policies',
          severity: 'high',
          probability: 0.7,
          impact: 'financial',
          jurisdiction: 'EU',
          regulation: 'GDPR',
          detected_at: '2024-01-15T10:00:00Z',
          mitigation_strategies: ['update_policies', 'staff_training'],
          estimated_cost: 50000
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRisks
      });

      const result = await service.assessComplianceRisks(request);

      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBase}/api/v1/predictive-intelligence/assess-risks`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request)
        })
      );
      expect(result).toEqual(mockRisks);
    });

    it('should get early warnings', async () => {
      const mockWarnings: EarlyWarning[] = [
        {
          id: 'warning-2',
          type: 'market_shift',
          priority: 'high',
          title: 'Market Volatility Expected',
          description: 'Unusual market patterns detected',
          timeline: '2-weeks',
          impact_areas: ['contracts', 'negotiations'],
          confidence: 0.8,
          created_at: '2024-01-15T10:00:00Z'
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWarnings
      });

      const result = await service.getEarlyWarnings('high');

      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBase}/api/v1/predictive-intelligence/early-warnings?priority=high`,
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toEqual(mockWarnings);
    });

    it('should perform pattern recognition', async () => {
      const mockPatterns: PatternRecognition[] = [
        {
          id: 'pattern-2',
          type: 'behavioral_pattern',
          name: 'Contract Amendment Cycles',
          description: 'Recurring contract amendment patterns',
          frequency: 'quarterly',
          strength: 0.9,
          risk_level: 'low',
          indicators: ['amendment_frequency', 'clause_changes'],
          last_detected: '2024-01-15T10:00:00Z',
          next_expected: '2024-04-15T10:00:00Z'
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPatterns
      });

      const result = await service.recognizePatterns(['behavioral_pattern'], 0.8);

      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBase}/api/v1/predictive-intelligence/recognize-patterns`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ 
            pattern_types: ['behavioral_pattern'], 
            min_strength: 0.8 
          })
        })
      );
      expect(result).toEqual(mockPatterns);
    });
  });

  // Predictive Analytics Tests
  describe('Predictive Analytics', () => {
    it('should generate predictive analytics', async () => {
      const request: ForecastRequest = {
        metrics: ['contract_volume', 'compliance_score'],
        timeframe: '12-months',
        granularity: 'monthly',
        include_confidence_intervals: true
      };

      const mockAnalytics: PredictiveAnalytics = {
        forecasts: [
          {
            id: 'forecast-1',
            metric: 'contract_volume',
            timeframe: '12-months',
            granularity: 'monthly',
            predictions: [
              { 
                period: '2024-02', 
                value: 150, 
                confidence_interval: { lower: 140, upper: 160 },
                probability: 0.85
              },
              { 
                period: '2024-03', 
                value: 155, 
                confidence_interval: { lower: 145, upper: 165 },
                probability: 0.82
              }
            ],
            accuracy_score: 0.87,
            model_type: 'lstm',
            created_at: '2024-01-15T10:00:00Z'
          }
        ],
        correlations: [
          {
            id: 'corr-1',
            event_type: 'regulatory_announcement',
            metric: 'compliance_inquiries',
            correlation_strength: 0.75,
            lag_time: '2-weeks',
            confidence: 0.8,
            historical_instances: 15,
            last_occurrence: '2024-01-01T00:00:00Z'
          }
        ],
        accuracy: {
          overall: 0.85,
          by_metric: {
            contract_volume: 0.87,
            compliance_score: 0.83
          },
          by_timeframe: {
            '1-month': 0.92,
            '3-months': 0.87,
            '12-months': 0.78
          },
          last_evaluated: '2024-01-15T10:00:00Z'
        }
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnalytics
      });

      const result = await service.generatePredictiveAnalytics(request);

      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBase}/api/v1/predictive-intelligence/predictive-analytics`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request)
        })
      );
      expect(result).toEqual(mockAnalytics);
    });

    it('should generate time series forecasts', async () => {
      const mockForecasts: TimeSeriesForecast[] = [
        {
          id: 'forecast-2',
          metric: 'risk_score',
          timeframe: '6-months',
          granularity: 'weekly',
          predictions: [
            { 
              period: '2024-01-22', 
              value: 72, 
              confidence_interval: { lower: 68, upper: 76 },
              probability: 0.88
            }
          ],
          accuracy_score: 0.84,
          model_type: 'arima',
          created_at: '2024-01-15T10:00:00Z'
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockForecasts
      });

      const result = await service.generateTimeSeriesForecasts(['risk_score'], '6-months');

      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBase}/api/v1/predictive-intelligence/time-series-forecasts`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ 
            metrics: ['risk_score'], 
            timeframe: '6-months' 
          })
        })
      );
      expect(result).toEqual(mockForecasts);
    });

    it('should analyze event correlations', async () => {
      const mockCorrelations: EventCorrelation[] = [
        {
          id: 'corr-2',
          event_type: 'market_volatility',
          metric: 'contract_disputes',
          correlation_strength: 0.65,
          lag_time: '1-month',
          confidence: 0.75,
          historical_instances: 8,
          last_occurrence: '2024-01-10T00:00:00Z'
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCorrelations
      });

      const result = await service.analyzeEventCorrelations(['market_volatility'], 0.6);

      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBase}/api/v1/predictive-intelligence/event-correlations`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ 
            event_types: ['market_volatility'], 
            min_correlation: 0.6 
          })
        })
      );
      expect(result).toEqual(mockCorrelations);
    });
  });

  // Intelligence Reports Tests
  describe('Intelligence Reports', () => {
    it('should generate intelligence report', async () => {
      const request: ReportGenerationRequest = {
        type: 'executive_briefing',
        sections: ['market_overview', 'risk_assessment', 'recommendations'],
        timeframe: 'quarterly',
        format: 'pdf',
        include_charts: true
      };

      const mockReport: IntelligenceReport = {
        id: 'report-1',
        type: 'executive_briefing',
        title: 'Q1 2024 Legal Intelligence Briefing',
        summary: 'Quarterly overview of legal market trends and risks',
        sections: [
          {
            title: 'Market Overview',
            content: 'Market showing increased regulatory activity...',
            charts: ['trend_chart_1', 'sentiment_chart_1'],
            key_insights: ['AI regulation increasing', 'Data privacy focus']
          }
        ],
        insights: ['Regulatory pressure increasing', 'Compliance costs rising'],
        recommendations: ['Update privacy policies', 'Increase compliance monitoring'],
        generated_at: '2024-01-15T10:00:00Z',
        expires_at: '2024-04-15T10:00:00Z',
        download_url: '/reports/download/report-1.pdf',
        metadata: { version: '1.0', classification: 'confidential' }
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockReport
      });

      const result = await service.generateIntelligenceReport(request);

      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBase}/api/v1/predictive-intelligence/generate-report`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request)
        })
      );
      expect(result).toEqual(mockReport);
    });

    it('should get executive briefings', async () => {
      const mockBriefings: ExecutiveBriefing[] = [
        {
          id: 'brief-1',
          title: 'Weekly Risk Summary',
          summary: 'Summary of key risks and opportunities',
          priority_items: ['GDPR update', 'Contract backlog'],
          risk_level: 'medium',
          key_metrics: {
            risk_score: 65,
            compliance_rate: 0.95,
            trend_direction: 'stable'
          },
          action_items: ['Review policies', 'Update training'],
          generated_at: '2024-01-15T10:00:00Z',
          period: '2024-01-08_2024-01-15'
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBriefings
      });

      const result = await service.getExecutiveBriefings('weekly', 5);

      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBase}/api/v1/predictive-intelligence/executive-briefings?frequency=weekly&limit=5`,
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toEqual(mockBriefings);
    });

    it('should configure alerts', async () => {
      const config: AlertConfiguration = {
        type: 'risk_threshold',
        conditions: {
          risk_score: { operator: 'greater_than', value: 80 },
          confidence: { operator: 'greater_than', value: 0.8 }
        },
        notifications: ['email', 'dashboard'],
        frequency: 'immediate',
        enabled: true
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'alert-config-1', ...config })
      });

      const result = await service.configureAlerts(config);

      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBase}/api/v1/predictive-intelligence/configure-alerts`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(config)
        })
      );
      expect(result).toEqual({ id: 'alert-config-1', ...config });
    });
  });

  // Scenario Planning Tests
  describe('Scenario Planning', () => {
    it('should run scenario simulation', async () => {
      const request: ScenarioRequest = {
        name: 'GDPR Enforcement Increase',
        description: 'Simulate impact of increased GDPR enforcement',
        variables: {
          enforcement_rate: 0.8,
          penalty_amount: 100000,
          compliance_cost: 50000
        },
        timeframe: '12-months',
        confidence_level: 0.9
      };

      const mockSimulation: ScenarioSimulation = {
        id: 'sim-1',
        name: 'GDPR Enforcement Increase',
        description: 'Simulation of increased GDPR enforcement impact',
        results: {
          financial_impact: 150000,
          operational_impact: 'high',
          compliance_burden: 0.7,
          risk_mitigation: 0.6
        },
        confidence: 0.85,
        assumptions: ['Current compliance rate', 'Historical penalty patterns'],
        limitations: ['Assumes linear enforcement increase'],
        created_at: '2024-01-15T10:00:00Z',
        scenario_data: {
          base_case: { risk_score: 50, compliance_cost: 30000 },
          simulated_case: { risk_score: 65, compliance_cost: 50000 }
        }
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSimulation
      });

      const result = await service.runScenarioSimulation(request);

      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBase}/api/v1/predictive-intelligence/scenario-simulation`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request)
        })
      );
      expect(result).toEqual(mockSimulation);
    });

    it('should model impact scenarios', async () => {
      const mockModels: ImpactModel[] = [
        {
          id: 'model-1',
          scenario: 'Regulatory Change',
          impact_type: 'operational',
          severity: 'high',
          probability: 0.7,
          financial_estimate: 200000,
          timeline: '6-months',
          affected_areas: ['compliance', 'operations', 'training'],
          mitigation_options: ['policy_update', 'staff_training', 'system_upgrade'],
          created_at: '2024-01-15T10:00:00Z'
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockModels
      });

      const result = await service.modelImpactScenarios(['Regulatory Change'], 'high');

      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBase}/api/v1/predictive-intelligence/impact-models`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ 
            scenarios: ['Regulatory Change'], 
            severity: 'high' 
          })
        })
      );
      expect(result).toEqual(mockModels);
    });

    it('should get mitigation strategies', async () => {
      const mockStrategies: MitigationStrategy[] = [
        {
          id: 'strategy-1',
          risk_type: 'compliance_risk',
          strategy: 'Enhanced Monitoring',
          description: 'Implement continuous compliance monitoring',
          effectiveness: 0.8,
          cost: 75000,
          implementation_time: '3-months',
          requirements: ['Staff training', 'System integration'],
          success_metrics: ['Compliance rate improvement', 'Risk score reduction'],
          priority: 'high'
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStrategies
      });

      const result = await service.getMitigationStrategies(['compliance_risk'], 'high');

      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBase}/api/v1/predictive-intelligence/mitigation-strategies?risk_types=compliance_risk&priority=high`,
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toEqual(mockStrategies);
    });
  });

  // Error Handling Tests
  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' })
      });

      await expect(service.getMarketIntelligenceDashboard())
        .rejects
        .toThrow('HTTP error! status: 500');
    });

    it('should handle network errors', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(service.getRiskManagementInterface())
        .rejects
        .toThrow('Network error');
    });

    it('should handle invalid JSON responses', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      await expect(service.generatePredictiveAnalytics({
        metrics: ['test'],
        timeframe: '1-month',
        granularity: 'daily',
        include_confidence_intervals: false
      })).rejects.toThrow('Invalid JSON');
    });
  });

  // Cache Management Tests
  describe('Cache Management', () => {
    it('should cache market intelligence dashboard', async () => {
      const mockDashboard: MarketIntelligenceDashboard = {
        trends: [],
        predictions: [],
        sentiment: {
          overall: 'neutral',
          score: 0.0,
          categories: { regulatory: 'neutral', market: 'neutral', technology: 'neutral' },
          trends: []
        },
        lastUpdated: '2024-01-15T10:00:00Z'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDashboard
      });

      // First call
      const result1 = await service.getMarketIntelligenceDashboard();
      
      // Second call should use cache
      const result2 = await service.getMarketIntelligenceDashboard();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('should clear cache', async () => {
      const mockDashboard: MarketIntelligenceDashboard = {
        trends: [],
        predictions: [],
        sentiment: {
          overall: 'neutral',
          score: 0.0,
          categories: { regulatory: 'neutral', market: 'neutral', technology: 'neutral' },
          trends: []
        },
        lastUpdated: '2024-01-15T10:00:00Z'
      };

      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockDashboard
      });

      // First call
      await service.getMarketIntelligenceDashboard();
      
      // Clear cache
      service.clearCache();
      
      // Second call should fetch again
      await service.getMarketIntelligenceDashboard();

      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should respect cache TTL', async () => {
      // Create a service with shorter cache TTL for testing
      const testService = new PredictiveIntelligenceService(mockApiBase);
      
      const mockDashboard: MarketIntelligenceDashboard = {
        trends: [],
        predictions: [],
        sentiment: {
          overall: 'neutral',
          score: 0.0,
          categories: { regulatory: 'neutral', market: 'neutral', technology: 'neutral' },
          trends: []
        },
        lastUpdated: '2024-01-15T10:00:00Z'
      };

      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockDashboard
      });

      // Mock Date.now to control cache expiry
      const originalDateNow = Date.now;
      let currentTime = 1000;
      Date.now = vi.fn(() => currentTime);

      // First call - should cache
      await testService.getMarketIntelligenceDashboard();
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second call within TTL - should use cache
      currentTime = 1000 + 60000; // 1 minute later
      await testService.getMarketIntelligenceDashboard();
      expect(fetch).toHaveBeenCalledTimes(1); // Still 1 call

      // Third call beyond cache TTL (5 minutes = 300000ms)
      currentTime = 1000 + 301000; // Beyond TTL
      await testService.getMarketIntelligenceDashboard();
      expect(fetch).toHaveBeenCalledTimes(2); // Should be 2 calls now

      // Restore original Date.now
      Date.now = originalDateNow;
    });
  });
});