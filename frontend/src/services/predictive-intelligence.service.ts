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
} from '../types/predictive-intelligence';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class PredictiveIntelligenceService {
  private readonly apiBase: string;
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly defaultCacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(apiBase: string = 'http://localhost:8000') {
    this.apiBase = apiBase;
  }

  private async fetchWithAuth<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem('authToken');
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    const response = await fetch(`${this.apiBase}${endpoint}`, config);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  private getCacheKey(endpoint: string, params?: any): string {
    if (!params) return endpoint;
    return `${endpoint}_${JSON.stringify(params)}`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl: number = this.defaultCacheTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  public clearCache(): void {
    this.cache.clear();
  }

  // Market Intelligence Dashboard Methods
  async getMarketIntelligenceDashboard(): Promise<MarketIntelligenceDashboard> {
    const cacheKey = this.getCacheKey('/api/v1/predictive-intelligence/market-dashboard');
    const cached = this.getFromCache<MarketIntelligenceDashboard>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const dashboard = await this.fetchWithAuth<MarketIntelligenceDashboard>(
      '/api/v1/predictive-intelligence/market-dashboard',
      { method: 'GET' }
    );

    this.setCache(cacheKey, dashboard);
    return dashboard;
  }

  async analyzeMarketTrends(request: TrendAnalysisRequest): Promise<MarketTrend[]> {
    const cacheKey = this.getCacheKey('/api/v1/predictive-intelligence/analyze-trends', request);
    const cached = this.getFromCache<MarketTrend[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const trends = await this.fetchWithAuth<MarketTrend[]>(
      '/api/v1/predictive-intelligence/analyze-trends',
      {
        method: 'POST',
        body: JSON.stringify(request)
      }
    );

    this.setCache(cacheKey, trends);
    return trends;
  }

  async getRegulatoryPredictions(
    jurisdiction?: string, 
    impact?: string
  ): Promise<RegulatoryPrediction[]> {
    const params = new URLSearchParams();
    if (jurisdiction) params.set('jurisdiction', jurisdiction);
    if (impact) params.set('impact', impact);

    const endpoint = `/api/v1/predictive-intelligence/regulatory-predictions${params.toString() ? `?${params.toString()}` : ''}`;
    const cacheKey = this.getCacheKey(endpoint);
    const cached = this.getFromCache<RegulatoryPrediction[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const predictions = await this.fetchWithAuth<RegulatoryPrediction[]>(
      endpoint,
      { method: 'GET' }
    );

    this.setCache(cacheKey, predictions);
    return predictions;
  }

  async analyzeMarketSentiment(categories: string[]): Promise<MarketSentiment> {
    const request = { categories };
    const cacheKey = this.getCacheKey('/api/v1/predictive-intelligence/market-sentiment', request);
    const cached = this.getFromCache<MarketSentiment>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const sentiment = await this.fetchWithAuth<MarketSentiment>(
      '/api/v1/predictive-intelligence/market-sentiment',
      {
        method: 'POST',
        body: JSON.stringify(request)
      }
    );

    this.setCache(cacheKey, sentiment);
    return sentiment;
  }

  // Risk Management Interface Methods
  async getRiskManagementInterface(): Promise<RiskManagementInterface> {
    const cacheKey = this.getCacheKey('/api/v1/predictive-intelligence/risk-management');
    const cached = this.getFromCache<RiskManagementInterface>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const riskInterface = await this.fetchWithAuth<RiskManagementInterface>(
      '/api/v1/predictive-intelligence/risk-management',
      { method: 'GET' }
    );

    this.setCache(cacheKey, riskInterface);
    return riskInterface;
  }

  async assessComplianceRisks(request: RiskAssessmentRequest): Promise<ComplianceRisk[]> {
    const cacheKey = this.getCacheKey('/api/v1/predictive-intelligence/assess-risks', request);
    const cached = this.getFromCache<ComplianceRisk[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const risks = await this.fetchWithAuth<ComplianceRisk[]>(
      '/api/v1/predictive-intelligence/assess-risks',
      {
        method: 'POST',
        body: JSON.stringify(request)
      }
    );

    this.setCache(cacheKey, risks);
    return risks;
  }

  async getEarlyWarnings(priority?: string): Promise<EarlyWarning[]> {
    const params = new URLSearchParams();
    if (priority) params.set('priority', priority);

    const endpoint = `/api/v1/predictive-intelligence/early-warnings${params.toString() ? `?${params.toString()}` : ''}`;
    const cacheKey = this.getCacheKey(endpoint);
    const cached = this.getFromCache<EarlyWarning[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const warnings = await this.fetchWithAuth<EarlyWarning[]>(
      endpoint,
      { method: 'GET' }
    );

    this.setCache(cacheKey, warnings);
    return warnings;
  }

  async recognizePatterns(
    patternTypes: string[], 
    minStrength?: number
  ): Promise<PatternRecognition[]> {
    const request = { 
      pattern_types: patternTypes,
      ...(minStrength !== undefined && { min_strength: minStrength })
    };
    
    const cacheKey = this.getCacheKey('/api/v1/predictive-intelligence/recognize-patterns', request);
    const cached = this.getFromCache<PatternRecognition[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const patterns = await this.fetchWithAuth<PatternRecognition[]>(
      '/api/v1/predictive-intelligence/recognize-patterns',
      {
        method: 'POST',
        body: JSON.stringify(request)
      }
    );

    this.setCache(cacheKey, patterns);
    return patterns;
  }

  // Predictive Analytics Methods
  async generatePredictiveAnalytics(request: ForecastRequest): Promise<PredictiveAnalytics> {
    const cacheKey = this.getCacheKey('/api/v1/predictive-intelligence/predictive-analytics', request);
    const cached = this.getFromCache<PredictiveAnalytics>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const analytics = await this.fetchWithAuth<PredictiveAnalytics>(
      '/api/v1/predictive-intelligence/predictive-analytics',
      {
        method: 'POST',
        body: JSON.stringify(request)
      }
    );

    this.setCache(cacheKey, analytics, 10 * 60 * 1000); // Cache for 10 minutes
    return analytics;
  }

  async generateTimeSeriesForecasts(
    metrics: string[], 
    timeframe: string
  ): Promise<TimeSeriesForecast[]> {
    const request = { metrics, timeframe };
    const cacheKey = this.getCacheKey('/api/v1/predictive-intelligence/time-series-forecasts', request);
    const cached = this.getFromCache<TimeSeriesForecast[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const forecasts = await this.fetchWithAuth<TimeSeriesForecast[]>(
      '/api/v1/predictive-intelligence/time-series-forecasts',
      {
        method: 'POST',
        body: JSON.stringify(request)
      }
    );

    this.setCache(cacheKey, forecasts, 15 * 60 * 1000); // Cache for 15 minutes
    return forecasts;
  }

  async analyzeEventCorrelations(
    eventTypes: string[], 
    minCorrelation?: number
  ): Promise<EventCorrelation[]> {
    const request = { 
      event_types: eventTypes,
      ...(minCorrelation !== undefined && { min_correlation: minCorrelation })
    };
    
    const cacheKey = this.getCacheKey('/api/v1/predictive-intelligence/event-correlations', request);
    const cached = this.getFromCache<EventCorrelation[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const correlations = await this.fetchWithAuth<EventCorrelation[]>(
      '/api/v1/predictive-intelligence/event-correlations',
      {
        method: 'POST',
        body: JSON.stringify(request)
      }
    );

    this.setCache(cacheKey, correlations, 20 * 60 * 1000); // Cache for 20 minutes
    return correlations;
  }

  // Intelligence Reports Methods
  async generateIntelligenceReport(request: ReportGenerationRequest): Promise<IntelligenceReport> {
    // Reports are not cached as they are typically one-time generations
    return this.fetchWithAuth<IntelligenceReport>(
      '/api/v1/predictive-intelligence/generate-report',
      {
        method: 'POST',
        body: JSON.stringify(request)
      }
    );
  }

  async getExecutiveBriefings(
    frequency?: string, 
    limit?: number
  ): Promise<ExecutiveBriefing[]> {
    const params = new URLSearchParams();
    if (frequency) params.set('frequency', frequency);
    if (limit) params.set('limit', limit.toString());

    const endpoint = `/api/v1/predictive-intelligence/executive-briefings${params.toString() ? `?${params.toString()}` : ''}`;
    const cacheKey = this.getCacheKey(endpoint);
    const cached = this.getFromCache<ExecutiveBriefing[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const briefings = await this.fetchWithAuth<ExecutiveBriefing[]>(
      endpoint,
      { method: 'GET' }
    );

    this.setCache(cacheKey, briefings, 30 * 60 * 1000); // Cache for 30 minutes
    return briefings;
  }

  async configureAlerts(config: AlertConfiguration): Promise<AlertConfiguration & { id: string }> {
    return this.fetchWithAuth<AlertConfiguration & { id: string }>(
      '/api/v1/predictive-intelligence/configure-alerts',
      {
        method: 'POST',
        body: JSON.stringify(config)
      }
    );
  }

  async getAlertConfigurations(): Promise<(AlertConfiguration & { id: string })[]> {
    const cacheKey = this.getCacheKey('/api/v1/predictive-intelligence/alert-configurations');
    const cached = this.getFromCache<(AlertConfiguration & { id: string })[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const configs = await this.fetchWithAuth<(AlertConfiguration & { id: string })[]>(
      '/api/v1/predictive-intelligence/alert-configurations',
      { method: 'GET' }
    );

    this.setCache(cacheKey, configs);
    return configs;
  }

  async updateAlertConfiguration(
    id: string, 
    config: Partial<AlertConfiguration>
  ): Promise<AlertConfiguration & { id: string }> {
    const updated = await this.fetchWithAuth<AlertConfiguration & { id: string }>(
      `/api/v1/predictive-intelligence/alert-configurations/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(config)
      }
    );

    // Clear related cache
    this.cache.delete(this.getCacheKey('/api/v1/predictive-intelligence/alert-configurations'));
    
    return updated;
  }

  async deleteAlertConfiguration(id: string): Promise<void> {
    await this.fetchWithAuth<void>(
      `/api/v1/predictive-intelligence/alert-configurations/${id}`,
      { method: 'DELETE' }
    );

    // Clear related cache
    this.cache.delete(this.getCacheKey('/api/v1/predictive-intelligence/alert-configurations'));
  }

  // Scenario Planning Methods
  async runScenarioSimulation(request: ScenarioRequest): Promise<ScenarioSimulation> {
    const cacheKey = this.getCacheKey('/api/v1/predictive-intelligence/scenario-simulation', request);
    const cached = this.getFromCache<ScenarioSimulation>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const simulation = await this.fetchWithAuth<ScenarioSimulation>(
      '/api/v1/predictive-intelligence/scenario-simulation',
      {
        method: 'POST',
        body: JSON.stringify(request)
      }
    );

    this.setCache(cacheKey, simulation, 60 * 60 * 1000); // Cache for 1 hour
    return simulation;
  }

  async modelImpactScenarios(
    scenarios: string[], 
    severity?: string
  ): Promise<ImpactModel[]> {
    const request = { scenarios, ...(severity && { severity }) };
    const cacheKey = this.getCacheKey('/api/v1/predictive-intelligence/impact-models', request);
    const cached = this.getFromCache<ImpactModel[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const models = await this.fetchWithAuth<ImpactModel[]>(
      '/api/v1/predictive-intelligence/impact-models',
      {
        method: 'POST',
        body: JSON.stringify(request)
      }
    );

    this.setCache(cacheKey, models, 45 * 60 * 1000); // Cache for 45 minutes
    return models;
  }

  async getMitigationStrategies(
    riskTypes: string[], 
    priority?: string
  ): Promise<MitigationStrategy[]> {
    const params = new URLSearchParams();
    params.set('risk_types', riskTypes.join(','));
    if (priority) params.set('priority', priority);

    const endpoint = `/api/v1/predictive-intelligence/mitigation-strategies?${params.toString()}`;
    const cacheKey = this.getCacheKey(endpoint);
    const cached = this.getFromCache<MitigationStrategy[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const strategies = await this.fetchWithAuth<MitigationStrategy[]>(
      endpoint,
      { method: 'GET' }
    );

    this.setCache(cacheKey, strategies, 30 * 60 * 1000); // Cache for 30 minutes
    return strategies;
  }

  async getScenarioHistory(limit?: number): Promise<ScenarioSimulation[]> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit.toString());

    const endpoint = `/api/v1/predictive-intelligence/scenario-history${params.toString() ? `?${params.toString()}` : ''}`;
    const cacheKey = this.getCacheKey(endpoint);
    const cached = this.getFromCache<ScenarioSimulation[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const history = await this.fetchWithAuth<ScenarioSimulation[]>(
      endpoint,
      { method: 'GET' }
    );

    this.setCache(cacheKey, history);
    return history;
  }

  // Utility Methods
  async getIntelligenceMetrics(): Promise<{
    total_predictions: number;
    accuracy_rate: number;
    active_alerts: number;
    last_updated: string;
  }> {
    const cacheKey = this.getCacheKey('/api/v1/predictive-intelligence/metrics');
    const cached = this.getFromCache<{
      total_predictions: number;
      accuracy_rate: number;
      active_alerts: number;
      last_updated: string;
    }>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const metrics = await this.fetchWithAuth<{
      total_predictions: number;
      accuracy_rate: number;
      active_alerts: number;
      last_updated: string;
    }>('/api/v1/predictive-intelligence/metrics', { method: 'GET' });

    this.setCache(cacheKey, metrics, 2 * 60 * 1000); // Cache for 2 minutes
    return metrics;
  }

  async exportIntelligenceData(format: 'json' | 'csv' | 'xlsx' = 'json'): Promise<Blob> {
    const response = await fetch(
      `${this.apiBase}/api/v1/predictive-intelligence/export?format=${format}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Export failed with status: ${response.status}`);
    }

    return response.blob();
  }

  async refreshIntelligenceData(): Promise<void> {
    await this.fetchWithAuth<void>(
      '/api/v1/predictive-intelligence/refresh',
      { method: 'POST' }
    );

    // Clear all cache after refresh
    this.clearCache();
  }

  // Advanced Analytics Methods
  async getCustomAnalytics(query: {
    metrics: string[];
    filters: Record<string, any>;
    aggregation: 'sum' | 'avg' | 'count' | 'max' | 'min';
    timeframe: string;
  }): Promise<{
    results: Array<{
      metric: string;
      value: number;
      period: string;
    }>;
    metadata: {
      query: any;
      execution_time: number;
      total_records: number;
    };
  }> {
    const cacheKey = this.getCacheKey('/api/v1/predictive-intelligence/custom-analytics', query);
    const cached = this.getFromCache<{
      results: Array<{
        metric: string;
        value: number;
        period: string;
      }>;
      metadata: {
        query: any;
        execution_time: number;
        total_records: number;
      };
    }>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const analytics = await this.fetchWithAuth<{
      results: Array<{
        metric: string;
        value: number;
        period: string;
      }>;
      metadata: {
        query: any;
        execution_time: number;
        total_records: number;
      };
    }>('/api/v1/predictive-intelligence/custom-analytics', {
      method: 'POST',
      body: JSON.stringify(query)
    });

    this.setCache(cacheKey, analytics, 10 * 60 * 1000); // Cache for 10 minutes
    return analytics;
  }

  // Real-time Updates
  createWebSocketConnection(): WebSocket {
    const wsUrl = this.apiBase.replace(/^http/, 'ws');
    const token = localStorage.getItem('authToken');
    const ws = new WebSocket(`${wsUrl}/api/v1/predictive-intelligence/ws?token=${token}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Handle real-time updates by clearing relevant cache entries
      if (data.type === 'market_update') {
        this.cache.delete(this.getCacheKey('/api/v1/predictive-intelligence/market-dashboard'));
      } else if (data.type === 'risk_alert') {
        this.cache.delete(this.getCacheKey('/api/v1/predictive-intelligence/risk-management'));
      } else if (data.type === 'prediction_update') {
        // Clear prediction-related cache entries
        for (const key of this.cache.keys()) {
          if (key.includes('predictive-analytics') || key.includes('forecasts')) {
            this.cache.delete(key);
          }
        }
      }
    };

    return ws;
  }
}