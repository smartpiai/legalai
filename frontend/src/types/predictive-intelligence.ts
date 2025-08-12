// Core Market Intelligence Types
export interface MarketTrend {
  id: string;
  title: string;
  category: 'regulatory' | 'market' | 'technology' | 'economic';
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  confidence: number;
  timeframe: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  data: TrendDataPoint[];
}

export interface TrendDataPoint {
  date: string;
  value: number;
  confidence: number;
}

export interface RegulatoryPrediction {
  id: string;
  type: 'new_regulation' | 'regulatory_change' | 'enforcement_update' | 'policy_shift';
  jurisdiction: string;
  title: string;
  confidence: number;
  timeframe: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  factors: string[];
  probability: number;
}

export interface MarketSentiment {
  overall: 'positive' | 'negative' | 'neutral';
  score: number;
  categories: {
    regulatory: 'positive' | 'negative' | 'neutral';
    market: 'positive' | 'negative' | 'neutral';
    technology: 'positive' | 'negative' | 'neutral';
  };
  trends: SentimentTrend[];
}

export interface SentimentTrend {
  period: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
}

export interface MarketIntelligenceDashboard {
  trends: MarketTrend[];
  predictions: RegulatoryPrediction[];
  sentiment: MarketSentiment;
  lastUpdated: string;
}

// Risk Management Types
export interface RiskAlert {
  id: string;
  type: 'compliance_risk' | 'market_risk' | 'operational_risk' | 'reputational_risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  category: string;
  source: 'automated_analysis' | 'manual_review' | 'external_feed';
  confidence: number;
  created_at: string;
  expires_at: string;
  actions: string[];
  metadata: Record<string, any>;
}

export interface EarlyWarning {
  id: string;
  type: 'regulatory_change' | 'market_shift' | 'compliance_deadline' | 'risk_escalation';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  timeline: string;
  impact_areas: string[];
  confidence: number;
  created_at: string;
}

export interface PatternRecognition {
  id: string;
  type: 'compliance_trend' | 'behavioral_pattern' | 'market_cycle' | 'regulatory_pattern';
  name: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  strength: number;
  risk_level: 'low' | 'medium' | 'high';
  indicators: string[];
  last_detected: string;
  next_expected: string;
}

export interface ComplianceRisk {
  id: string;
  category: 'regulatory' | 'operational' | 'financial' | 'reputational';
  type: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number;
  impact: 'financial' | 'operational' | 'reputational' | 'legal';
  jurisdiction: string;
  regulation: string;
  detected_at: string;
  mitigation_strategies: string[];
  estimated_cost: number;
}

export interface RiskManagementInterface {
  alerts: RiskAlert[];
  warnings: EarlyWarning[];
  patterns: PatternRecognition[];
  riskScore: number;
  lastUpdated: string;
}

// Predictive Analytics Types
export interface TimeSeriesForecast {
  id: string;
  metric: string;
  timeframe: string;
  granularity: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
  predictions: ForecastPrediction[];
  accuracy_score: number;
  model_type: 'arima' | 'lstm' | 'prophet' | 'linear_regression';
  created_at: string;
}

export interface ForecastPrediction {
  period: string;
  value: number;
  confidence_interval: {
    lower: number;
    upper: number;
  };
  probability: number;
}

export interface EventCorrelation {
  id: string;
  event_type: string;
  metric: string;
  correlation_strength: number;
  lag_time: string;
  confidence: number;
  historical_instances: number;
  last_occurrence: string;
}

export interface PredictionAccuracy {
  overall: number;
  by_metric: Record<string, number>;
  by_timeframe: Record<string, number>;
  last_evaluated: string;
}

export interface PredictiveAnalytics {
  forecasts: TimeSeriesForecast[];
  correlations: EventCorrelation[];
  accuracy: PredictionAccuracy;
}

// Intelligence Reports Types
export interface ReportSection {
  title: string;
  content: string;
  charts: string[];
  key_insights: string[];
}

export interface IntelligenceReport {
  id: string;
  type: 'executive_briefing' | 'risk_assessment' | 'market_analysis' | 'compliance_report';
  title: string;
  summary: string;
  sections: ReportSection[];
  insights: string[];
  recommendations: string[];
  generated_at: string;
  expires_at: string;
  download_url: string;
  metadata: Record<string, any>;
}

export interface ExecutiveBriefing {
  id: string;
  title: string;
  summary: string;
  priority_items: string[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  key_metrics: {
    risk_score: number;
    compliance_rate: number;
    trend_direction: 'improving' | 'stable' | 'declining';
  };
  action_items: string[];
  generated_at: string;
  period: string;
}

export interface AlertConfiguration {
  type: string;
  conditions: Record<string, {
    operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
    value: number | string;
  }>;
  notifications: ('email' | 'sms' | 'dashboard' | 'webhook')[];
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  enabled: boolean;
}

// Scenario Planning Types
export interface ScenarioSimulation {
  id: string;
  name: string;
  description: string;
  results: {
    financial_impact: number;
    operational_impact: 'low' | 'medium' | 'high';
    compliance_burden: number;
    risk_mitigation: number;
  };
  confidence: number;
  assumptions: string[];
  limitations: string[];
  created_at: string;
  scenario_data: Record<string, any>;
}

export interface ImpactModel {
  id: string;
  scenario: string;
  impact_type: 'financial' | 'operational' | 'reputational' | 'legal';
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number;
  financial_estimate: number;
  timeline: string;
  affected_areas: string[];
  mitigation_options: string[];
  created_at: string;
}

export interface MitigationStrategy {
  id: string;
  risk_type: string;
  strategy: string;
  description: string;
  effectiveness: number;
  cost: number;
  implementation_time: string;
  requirements: string[];
  success_metrics: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

// Request Types
export interface TrendAnalysisRequest {
  categories: string[];
  timeframe: string;
  jurisdictions?: string[];
  confidence_threshold?: number;
}

export interface RiskAssessmentRequest {
  categories: string[];
  jurisdictions: string[];
  time_horizon: string;
  include_mitigations: boolean;
}

export interface ForecastRequest {
  metrics: string[];
  timeframe: string;
  granularity: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
  include_confidence_intervals: boolean;
}

export interface ReportGenerationRequest {
  type: 'executive_briefing' | 'risk_assessment' | 'market_analysis' | 'compliance_report';
  sections: string[];
  timeframe: string;
  format: 'pdf' | 'html' | 'json';
  include_charts: boolean;
}

export interface ScenarioRequest {
  name: string;
  description: string;
  variables: Record<string, number>;
  timeframe: string;
  confidence_level: number;
}