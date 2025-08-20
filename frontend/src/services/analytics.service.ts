/**
 * Analytics Service - Performance and KPI Metrics API Integration
 * Provides analytics data operations and metrics retrieval
 */

import { apiClient } from './apiClient';

interface KPISummary {
  totalContracts: number;
  activeContracts: number;
  contractValue: number;
  complianceRate: number;
  avgProcessingTime: number;
  userSatisfaction: number;
}

interface TrendData {
  daily: Array<{ date: string; contracts: number; value: number; time: number }>;
  weekly: Array<{ week: string; contracts: number; value: number; compliance: number }>;
  monthly: Array<{ month: string; contracts: number; value: number; satisfaction: number }>;
}

interface KPITargets {
  contractsTarget: number;
  valueTarget: number;
  complianceTarget: number;
  processingTarget: number;
  satisfactionTarget: number;
}

interface KPIMetrics {
  summary: KPISummary;
  trends: TrendData;
  targets: KPITargets;
}

interface SystemMetrics {
  uptime: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
  cpu: number;
  memory: number;
  storage: number;
}

interface APIMetrics {
  totalRequests: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  successRate: number;
}

interface UserMetrics {
  activeUsers: number;
  sessionsPerDay: number;
  avgSessionDuration: number;
  bounceRate: number;
  pageViews: number;
}

interface PerformanceMetrics {
  systemMetrics: SystemMetrics;
  apiMetrics: APIMetrics;
  userMetrics: UserMetrics;
}

interface ContractMetrics {
  byStatus: Array<{ status: string; count: number; percentage: number }>;
  byType: Array<{ type: string; count: number; value: number }>;
}

interface ComplianceMetrics {
  overallCompliance: number;
  byCategory: Array<{ category: string; rate: number }>;
  violations: number;
  resolved: number;
}

interface RevenueMetrics {
  totalRevenue: number;
  recurring: number;
  oneTime: number;
  growth: number;
  churn: number;
}

interface Alert {
  id: string;
  metric: string;
  current: number;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
}

interface Benchmark {
  industry: {
    avgProcessingTime: number;
    avgComplianceRate: number;
    avgSatisfaction: number;
  };
  percentile: {
    processingTime: number;
    complianceRate: number;
    satisfaction: number;
  };
}

interface ComparativeAnalysis {
  current: KPISummary;
  previous: Partial<KPISummary>;
  change: Record<string, string>;
}

export class AnalyticsService {
  private api: AxiosInstance;

  constructor() {
    apiClient = // Using centralized apiClient;

    // Add auth headers
    apiClient.interceptors.request.use((config) => {
      const state = useAuthStore.getState();
      const token = state.token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      if (state.user?.tenant_id) {
        config.headers['X-Tenant-ID'] = state.user.tenant_id;
      }
      return config;
    });
  }

  async getKPIMetrics(params?: { timeRange?: string; tenantId?: string }): Promise<KPIMetrics> {
    const response = await apiClient.get('/analytics/kpi', { params });
    return response.data;
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const response = await apiClient.get('/analytics/performance');
    return response.data;
  }

  async getContractMetrics(): Promise<ContractMetrics> {
    const response = await apiClient.get('/analytics/contracts');
    return response.data;
  }

  async getUserActivityMetrics(): Promise<UserMetrics> {
    const response = await apiClient.get('/analytics/users');
    return response.data;
  }

  async getComplianceMetrics(): Promise<ComplianceMetrics> {
    const response = await apiClient.get('/analytics/compliance');
    return response.data;
  }

  async getRevenueMetrics(): Promise<RevenueMetrics> {
    const response = await apiClient.get('/analytics/revenue');
    return response.data;
  }

  async getTrendData(metric: string, period: string): Promise<Array<any>> {
    const response = await apiClient.get(`/analytics/trends/${metric}`, {
      params: { period },
    });
    return response.data;
  }

  async getBenchmarks(): Promise<Benchmark> {
    const response = await apiClient.get('/analytics/benchmarks');
    return response.data;
  }

  async exportMetrics(params: {
    format: string;
    timeRange?: string;
    metrics?: string[];
    includeCharts?: boolean;
  }): Promise<{ url: string }> {
    const response = await apiClient.post('/analytics/export', params);
    return response.data;
  }

  async getAlerts(): Promise<Alert[]> {
    const response = await apiClient.get('/analytics/alerts');
    return response.data;
  }

  async updateAlertThreshold(params: {
    metric: string;
    threshold: number;
  }): Promise<void> {
    await apiClient.put('/analytics/alerts/threshold', params);
  }

  async getComparativeAnalysis(period: string): Promise<ComparativeAnalysis> {
    const response = await apiClient.get('/analytics/compare', {
      params: { period },
    });
    return response.data;
  }

  async scheduleReport(params: {
    frequency: string;
    day?: string;
    time?: string;
    recipients: string[];
    metrics: string[];
  }): Promise<{ id: string }> {
    const response = await apiClient.post('/analytics/schedule', params);
    return response.data;
  }
}

export const analyticsService = new AnalyticsService();