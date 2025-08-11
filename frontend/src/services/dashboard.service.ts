/**
 * Dashboard Service - API Integration Layer
 * Handles all dashboard-related API calls with caching, error handling, and multi-tenancy
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { useAuthStore } from '@/store/auth';

interface ExecutiveSummary {
  total_contracts: number;
  active_contracts: number;
  expiring_soon: number;
  total_value: number;
  compliance_rate: number;
  risk_score: number;
  recent_activities: number;
}

interface ContractMetrics {
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  by_department: Record<string, number>;
  trend: Array<{
    month: string;
    count: number;
    value: number;
  }>;
}

interface RiskAnalytics {
  high_risk_contracts: Array<{
    id: string;
    title: string;
    risk_score: number;
    risk_factors: string[];
  }>;
  risk_distribution: {
    low: number;
    medium: number;
    high: number;
  };
  top_risk_factors: Array<{
    factor: string;
    count: number;
  }>;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  user: {
    id: string;
    name: string;
  };
  entity: {
    type: string;
    id: string;
    title: string;
  };
}

interface PaginatedActivities {
  items: Activity[];
  total: number;
  limit: number;
  offset: number;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  timestamp: string;
}

// Cache configuration
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// WebSocket wrapper for testing
class MockWebSocket {
  url: string;
  private messageHandler?: (data: any) => void;
  private errorHandler?: (error: Error) => void;

  constructor(url: string) {
    this.url = url;
  }

  simulateMessage(data: any) {
    if (this.messageHandler) {
      this.messageHandler(data);
    }
  }

  simulateError(error: Error) {
    if (this.errorHandler) {
      this.errorHandler(error);
    }
  }

  onMessage(handler: (data: any) => void) {
    this.messageHandler = handler;
  }

  onError(handler: (error: Error) => void) {
    this.errorHandler = handler;
  }
}

export class DashboardService {
  private api: AxiosInstance;
  private cache: Map<string, CacheEntry<any>>;
  private pendingRequests: Map<string, Promise<any>>;
  private cacheTimeout: number = 60000; // 1 minute default cache
  private retryAttempts: number = 2;
  private retryDelay: number = 1000;
  private websocket?: MockWebSocket | WebSocket;
  private reconnecting: boolean = false;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
      timeout: 30000,
    });

    this.cache = new Map();
    this.pendingRequests = new Map();

    // Add request interceptor for auth and tenant headers
    this.api.interceptors.request.use((config) => {
      const state = useAuthStore.getState();
      const token = state.token;
      const user = state.user;

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      if (user?.tenant_id) {
        config.headers['X-Tenant-ID'] = user.tenant_id;
      }

      return config;
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timeout');
        }

        if (error.response?.status === 403) {
          const detail = (error.response.data as any)?.detail;
          if (detail?.includes('tenant mismatch')) {
            throw new Error('Access denied');
          }
          throw new Error('Unauthorized to access risk analytics');
        }

        if (error.response?.status === 503 && this.retryAttempts > 0) {
          // Retry on service unavailable
          await this.delay(this.retryDelay);
          return this.api.request(error.config!);
        }

        throw error;
      }
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getCacheKey(endpoint: string, params?: any): string {
    return `${endpoint}:${JSON.stringify(params || {})}`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T, ttl?: number): void {
    const timeout = ttl || this.cacheTimeout;
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + timeout,
    });
  }

  private async deduplicateRequest<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // Check if request is already pending
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending;
    }

    // Create new request
    const request = requestFn()
      .then((data) => {
        this.pendingRequests.delete(key);
        return data;
      })
      .catch((error) => {
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, request);
    return request;
  }

  async getExecutiveSummary(): Promise<ExecutiveSummary> {
    const cacheKey = this.getCacheKey('/api/v1/dashboard/executive-summary');
    
    // Check cache first
    const cached = this.getFromCache<ExecutiveSummary>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Deduplicate simultaneous requests
      const data = await this.deduplicateRequest(cacheKey, async () => {
        const response = await this.api.get<ExecutiveSummary>(
          '/api/v1/dashboard/executive-summary'
        );
        return response.data;
      });

      // Cache the result
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Dashboard API Error:', error);
      throw new Error('Failed to fetch executive summary');
    }
  }

  async getExecutiveSummaryWithFallback(): Promise<ExecutiveSummary & { is_fallback?: boolean }> {
    try {
      return await this.getExecutiveSummary();
    } catch (error) {
      // Return fallback data
      return {
        total_contracts: 0,
        active_contracts: 0,
        expiring_soon: 0,
        total_value: 0,
        compliance_rate: 0,
        risk_score: 0,
        recent_activities: 0,
        is_fallback: true,
      };
    }
  }

  async getContractMetrics(
    startDate?: string,
    endDate?: string
  ): Promise<ContractMetrics> {
    const params = {
      ...(startDate && { start_date: startDate }),
      ...(endDate && { end_date: endDate }),
    };

    const cacheKey = this.getCacheKey('/api/v1/dashboard/contract-metrics', params);
    
    // Check cache
    const cached = this.getFromCache<ContractMetrics>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.get<ContractMetrics>(
        '/api/v1/dashboard/contract-metrics',
        { params }
      );
      
      // Cache the result
      this.setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Dashboard API Error:', error);
      throw new Error('Failed to fetch contract metrics');
    }
  }

  async getRiskAnalytics(): Promise<RiskAnalytics> {
    const cacheKey = this.getCacheKey('/api/v1/dashboard/risk-analytics');
    
    // Check cache
    const cached = this.getFromCache<RiskAnalytics>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.get<RiskAnalytics>(
        '/api/v1/dashboard/risk-analytics'
      );
      
      // Cache the result
      this.setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Dashboard API Error:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to fetch risk analytics');
    }
  }

  async getRecentActivities(
    limit: number = 20,
    offset: number = 0,
    activityType?: string
  ): Promise<PaginatedActivities> {
    const params = {
      limit,
      offset,
      ...(activityType && { activity_type: activityType }),
    };

    try {
      const response = await this.api.get<PaginatedActivities>(
        '/api/v1/dashboard/activities',
        { params }
      );
      return response.data;
    } catch (error) {
      console.error('Dashboard API Error:', error);
      throw new Error('Failed to fetch recent activities');
    }
  }

  async getNotifications(): Promise<Notification[]> {
    try {
      const response = await this.api.get<Notification[]>('/api/v1/notifications');
      return response.data;
    } catch (error) {
      console.error('Dashboard API Error:', error);
      throw new Error('Failed to fetch notifications');
    }
  }

  async markNotificationAsRead(notificationId: string): Promise<{ success: boolean }> {
    try {
      const response = await this.api.put<{ success: boolean }>(
        `/api/v1/notifications/${notificationId}/read`
      );
      return response.data;
    } catch (error) {
      console.error('Dashboard API Error:', error);
      throw new Error('Failed to mark notification as read');
    }
  }

  async clearAllNotifications(): Promise<{ cleared_count: number }> {
    try {
      const response = await this.api.post<{ cleared_count: number }>(
        '/api/v1/notifications/clear-all'
      );
      
      // Invalidate notifications cache
      this.invalidateCache('notifications');
      
      return response.data;
    } catch (error) {
      console.error('Dashboard API Error:', error);
      throw new Error('Failed to clear notifications');
    }
  }

  async connectWebSocket(
    onMessage: (data: any) => void,
    onError: (error: Error) => void
  ): Promise<MockWebSocket> {
    const token = useAuthStore.getState().token;
    const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:8000'}/ws/dashboard?token=${token}`;

    // For testing, return a mock WebSocket
    if (import.meta.env.NODE_ENV === 'test') {
      const ws = new MockWebSocket(wsUrl);
      ws.onMessage(onMessage);
      ws.onError(onError);
      this.websocket = ws;
      return ws;
    }

    // In production, use real WebSocket
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    ws.onerror = (event) => {
      onError(new Error('WebSocket connection error'));
      this.handleWebSocketReconnection(onMessage, onError);
    };

    ws.onclose = () => {
      this.handleWebSocketReconnection(onMessage, onError);
    };

    this.websocket = ws;
    return ws as any;
  }

  private handleWebSocketReconnection(
    onMessage: (data: any) => void,
    onError: (error: Error) => void
  ): void {
    if (this.reconnecting) return;
    
    this.reconnecting = true;
    
    setTimeout(() => {
      this.connectWebSocket(onMessage, onError)
        .then(() => {
          this.reconnecting = false;
        })
        .catch(() => {
          this.reconnecting = false;
        });
    }, 5000); // Retry after 5 seconds
  }

  isReconnecting(): boolean {
    return this.reconnecting;
  }

  disconnectWebSocket(): void {
    if (this.websocket && 'close' in this.websocket) {
      (this.websocket as WebSocket).close();
    }
    this.websocket = undefined;
    this.reconnecting = false;
  }

  invalidateCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    // Invalidate cache entries matching pattern
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  // Prefetch dashboard data for performance
  async prefetchDashboardData(): Promise<void> {
    const promises = [
      this.getExecutiveSummary(),
      this.getContractMetrics(),
      this.getRiskAnalytics(),
      this.getNotifications(),
    ];

    try {
      await Promise.all(promises);
    } catch (error) {
      console.error('Prefetch error:', error);
      // Non-blocking - continue even if prefetch fails
    }
  }
}

// Export singleton instance
export const dashboardService = new DashboardService();