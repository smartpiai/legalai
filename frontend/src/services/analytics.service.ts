/**
 * Analytics Service - Performance and KPI Metrics API Integration
 * Provides analytics data operations and metrics retrieval
 */

import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from '../store/auth';

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
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
      timeout: 30000,
    });

    // Add auth headers
    this.api.interceptors.request.use((config) => {
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
    const response = await this.api.get('/api/v1/analytics/kpi', { params });
    return response.data;
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const response = await this.api.get('/api/v1/analytics/performance');
    return response.data;
  }

  async getContractMetrics(): Promise<ContractMetrics> {
    const response = await this.api.get('/api/v1/analytics/contracts');
    return response.data;
  }

  async getUserActivityMetrics(): Promise<UserMetrics> {
    const response = await this.api.get('/api/v1/analytics/users');
    return response.data;
  }

  async getComplianceMetrics(): Promise<ComplianceMetrics> {
    const response = await this.api.get('/api/v1/analytics/compliance');
    return response.data;
  }

  async getRevenueMetrics(): Promise<RevenueMetrics> {
    const response = await this.api.get('/api/v1/analytics/revenue');
    return response.data;
  }

  async getTrendData(metric: string, period: string): Promise<Array<any>> {
    const response = await this.api.get(`/api/v1/analytics/trends/${metric}`, {
      params: { period },
    });
    return response.data;
  }

  async getBenchmarks(): Promise<Benchmark> {
    const response = await this.api.get('/api/v1/analytics/benchmarks');
    return response.data;
  }

  async exportMetrics(params: {
    format: string;
    timeRange?: string;
    metrics?: string[];
    includeCharts?: boolean;
  }): Promise<{ url: string }> {
    const response = await this.api.post('/api/v1/analytics/export', params);
    return response.data;
  }

  async getAlerts(): Promise<Alert[]> {
    const response = await this.api.get('/api/v1/analytics/alerts');
    return response.data;
  }

  async updateAlertThreshold(params: {
    metric: string;
    threshold: number;
  }): Promise<void> {
    await this.api.put('/api/v1/analytics/alerts/threshold', params);
  }

  async getComparativeAnalysis(period: string): Promise<ComparativeAnalysis> {
    const response = await this.api.get('/api/v1/analytics/compare', {
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
    const response = await this.api.post('/api/v1/analytics/schedule', params);
    return response.data;
  }
}

export const analyticsService = new AnalyticsService();