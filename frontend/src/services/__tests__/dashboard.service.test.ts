/**
 * Dashboard Service Integration Tests
 * Following TDD - RED phase: Writing failing tests first
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { DashboardService } from '../dashboard.service';
import { authStore } from '../../stores/authStore';

// Mock axios
const mockAxios = new MockAdapter(axios);

describe('DashboardService', () => {
  let dashboardService: DashboardService;
  const mockToken = 'test-jwt-token';
  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-456';

  beforeEach(() => {
    // Setup auth store mock
    vi.spyOn(authStore.getState(), 'token', 'get').mockReturnValue(mockToken);
    vi.spyOn(authStore.getState(), 'user', 'get').mockReturnValue({
      id: mockUserId,
      tenant_id: mockTenantId,
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      permissions: ['contracts.read', 'contracts.write', 'analytics.view'],
    });

    dashboardService = new DashboardService();
    mockAxios.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getExecutiveSummary', () => {
    it('should fetch executive summary data with proper authorization', async () => {
      const mockSummary = {
        total_contracts: 150,
        active_contracts: 120,
        expiring_soon: 15,
        total_value: 5000000,
        compliance_rate: 0.95,
        risk_score: 0.25,
        recent_activities: 45,
      };

      mockAxios.onGet('/api/v1/dashboard/executive-summary').reply(200, mockSummary);

      const result = await dashboardService.getExecutiveSummary();

      expect(result).toEqual(mockSummary);
      expect(mockAxios.history.get[0].headers?.Authorization).toBe(`Bearer ${mockToken}`);
      expect(mockAxios.history.get[0].headers?.['X-Tenant-ID']).toBe(mockTenantId);
    });

    it('should handle API errors gracefully', async () => {
      mockAxios.onGet('/api/v1/dashboard/executive-summary').reply(500, {
        detail: 'Internal server error',
      });

      await expect(dashboardService.getExecutiveSummary()).rejects.toThrow(
        'Failed to fetch executive summary'
      );
    });

    it('should retry on network failures', async () => {
      mockAxios
        .onGet('/api/v1/dashboard/executive-summary')
        .replyOnce(503)
        .onGet('/api/v1/dashboard/executive-summary')
        .replyOnce(200, { total_contracts: 100 });

      const result = await dashboardService.getExecutiveSummary();
      
      expect(result.total_contracts).toBe(100);
      expect(mockAxios.history.get).toHaveLength(2);
    });
  });

  describe('getContractMetrics', () => {
    it('should fetch contract metrics with date range filter', async () => {
      const mockMetrics = {
        by_status: {
          draft: 20,
          active: 80,
          expired: 15,
          terminated: 5,
        },
        by_type: {
          service_agreement: 45,
          nda: 30,
          purchase_order: 25,
          license: 20,
        },
        by_department: {
          legal: 40,
          procurement: 35,
          sales: 25,
          hr: 20,
        },
        trend: [
          { month: '2024-01', count: 10, value: 100000 },
          { month: '2024-02', count: 15, value: 150000 },
        ],
      };

      const startDate = '2024-01-01';
      const endDate = '2024-02-28';

      mockAxios
        .onGet('/api/v1/dashboard/contract-metrics', {
          params: { start_date: startDate, end_date: endDate },
        })
        .reply(200, mockMetrics);

      const result = await dashboardService.getContractMetrics(startDate, endDate);

      expect(result).toEqual(mockMetrics);
      expect(mockAxios.history.get[0].params).toEqual({
        start_date: startDate,
        end_date: endDate,
      });
    });

    it('should cache metrics data for performance', async () => {
      const mockMetrics = { by_status: { active: 100 } };
      
      mockAxios.onGet('/api/v1/dashboard/contract-metrics').reply(200, mockMetrics);

      // First call
      await dashboardService.getContractMetrics();
      
      // Second call within cache period
      await dashboardService.getContractMetrics();

      // Should only make one API call due to caching
      expect(mockAxios.history.get).toHaveLength(1);
    });
  });

  describe('getRiskAnalytics', () => {
    it('should fetch risk analytics data', async () => {
      const mockRiskData = {
        high_risk_contracts: [
          {
            id: 'contract-1',
            title: 'Service Agreement',
            risk_score: 0.85,
            risk_factors: ['Missing SLA', 'No termination clause'],
          },
        ],
        risk_distribution: {
          low: 60,
          medium: 30,
          high: 10,
        },
        top_risk_factors: [
          { factor: 'Missing clauses', count: 25 },
          { factor: 'Expired insurance', count: 18 },
        ],
      };

      mockAxios.onGet('/api/v1/dashboard/risk-analytics').reply(200, mockRiskData);

      const result = await dashboardService.getRiskAnalytics();

      expect(result).toEqual(mockRiskData);
      expect(result.high_risk_contracts).toHaveLength(1);
      expect(result.risk_distribution.low).toBe(60);
    });

    it('should handle unauthorized access', async () => {
      mockAxios.onGet('/api/v1/dashboard/risk-analytics').reply(403, {
        detail: 'Insufficient permissions',
      });

      await expect(dashboardService.getRiskAnalytics()).rejects.toThrow(
        'Unauthorized to access risk analytics'
      );
    });
  });

  describe('getRecentActivities', () => {
    it('should fetch paginated recent activities', async () => {
      const mockActivities = {
        items: [
          {
            id: 'activity-1',
            type: 'contract_created',
            title: 'New contract created',
            description: 'Service Agreement created by John Doe',
            timestamp: '2024-02-15T10:00:00Z',
            user: { id: 'user-1', name: 'John Doe' },
            entity: { type: 'contract', id: 'contract-1', title: 'Service Agreement' },
          },
        ],
        total: 100,
        limit: 20,
        offset: 0,
      };

      mockAxios
        .onGet('/api/v1/dashboard/activities', {
          params: { limit: 20, offset: 0 },
        })
        .reply(200, mockActivities);

      const result = await dashboardService.getRecentActivities(20, 0);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(100);
      expect(mockAxios.history.get[0].params).toEqual({ limit: 20, offset: 0 });
    });

    it('should support activity type filtering', async () => {
      const mockActivities = {
        items: [],
        total: 0,
        limit: 20,
        offset: 0,
      };

      mockAxios
        .onGet('/api/v1/dashboard/activities', {
          params: { 
            limit: 20, 
            offset: 0, 
            activity_type: 'contract_approved' 
          },
        })
        .reply(200, mockActivities);

      const result = await dashboardService.getRecentActivities(
        20,
        0,
        'contract_approved'
      );

      expect(result.items).toHaveLength(0);
      expect(mockAxios.history.get[0].params.activity_type).toBe('contract_approved');
    });
  });

  describe('getNotifications', () => {
    it('should fetch user notifications', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          title: 'Contract Review Required',
          message: 'Contract CON-2024-001 requires your review',
          type: 'warning',
          read: false,
          timestamp: '2024-02-15T12:00:00Z',
        },
        {
          id: 'notif-2',
          title: 'Contract Approved',
          message: 'Your contract has been approved',
          type: 'success',
          read: true,
          timestamp: '2024-02-14T15:00:00Z',
        },
      ];

      mockAxios.onGet('/api/v1/notifications').reply(200, mockNotifications);

      const result = await dashboardService.getNotifications();

      expect(result).toHaveLength(2);
      expect(result[0].read).toBe(false);
      expect(result[1].type).toBe('success');
    });

    it('should mark notification as read', async () => {
      mockAxios.onPut('/api/v1/notifications/notif-1/read').reply(200, {
        success: true,
      });

      const result = await dashboardService.markNotificationAsRead('notif-1');

      expect(result.success).toBe(true);
      expect(mockAxios.history.put[0].url).toBe('/api/v1/notifications/notif-1/read');
    });

    it('should clear all notifications', async () => {
      mockAxios.onPost('/api/v1/notifications/clear-all').reply(200, {
        cleared_count: 5,
      });

      const result = await dashboardService.clearAllNotifications();

      expect(result.cleared_count).toBe(5);
    });
  });

  describe('WebSocket real-time updates', () => {
    it('should establish WebSocket connection for real-time updates', async () => {
      const mockWsUrl = `ws://localhost:8000/ws/dashboard?token=${mockToken}`;
      const onMessage = vi.fn();
      const onError = vi.fn();

      const ws = await dashboardService.connectWebSocket(onMessage, onError);

      expect(ws).toBeDefined();
      expect(ws.url).toContain('/ws/dashboard');
      expect(ws.url).toContain(`token=${mockToken}`);
    });

    it('should handle WebSocket messages', async () => {
      const onMessage = vi.fn();
      const mockMessage = {
        type: 'contract_update',
        data: {
          contract_id: 'contract-1',
          status: 'approved',
        },
      };

      const ws = await dashboardService.connectWebSocket(onMessage, vi.fn());
      
      // Simulate receiving a message
      ws.simulateMessage(mockMessage);

      expect(onMessage).toHaveBeenCalledWith(mockMessage);
    });

    it('should reconnect on WebSocket failure', async () => {
      const onError = vi.fn();
      const ws = await dashboardService.connectWebSocket(vi.fn(), onError);

      // Simulate connection error
      ws.simulateError(new Error('Connection lost'));

      expect(onError).toHaveBeenCalled();
      // Should attempt reconnection
      expect(dashboardService.isReconnecting()).toBe(true);
    });
  });

  describe('Multi-tenant isolation', () => {
    it('should include tenant ID in all API requests', async () => {
      mockAxios.onGet('/api/v1/dashboard/executive-summary').reply(200, {});
      mockAxios.onGet('/api/v1/dashboard/contract-metrics').reply(200, {});
      mockAxios.onGet('/api/v1/dashboard/risk-analytics').reply(200, {});

      await dashboardService.getExecutiveSummary();
      await dashboardService.getContractMetrics();
      await dashboardService.getRiskAnalytics();

      // Verify all requests include tenant ID header
      mockAxios.history.get.forEach((request) => {
        expect(request.headers?.['X-Tenant-ID']).toBe(mockTenantId);
      });
    });

    it('should prevent cross-tenant data access', async () => {
      // Change tenant ID in auth store
      vi.spyOn(authStore.getState(), 'user', 'get').mockReturnValue({
        id: mockUserId,
        tenant_id: 'different-tenant',
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        permissions: [],
      });

      mockAxios.onGet('/api/v1/dashboard/executive-summary').reply(403, {
        detail: 'Access denied: tenant mismatch',
      });

      await expect(dashboardService.getExecutiveSummary()).rejects.toThrow(
        'Access denied'
      );
    });
  });

  describe('Performance and caching', () => {
    it('should batch multiple API calls efficiently', async () => {
      const promises = [
        dashboardService.getExecutiveSummary(),
        dashboardService.getContractMetrics(),
        dashboardService.getRiskAnalytics(),
      ];

      mockAxios.onGet('/api/v1/dashboard/executive-summary').reply(200, {});
      mockAxios.onGet('/api/v1/dashboard/contract-metrics').reply(200, {});
      mockAxios.onGet('/api/v1/dashboard/risk-analytics').reply(200, {});

      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All requests should be made in parallel
      expect(duration).toBeLessThan(100); // Should complete quickly
      expect(mockAxios.history.get).toHaveLength(3);
    });

    it('should implement request deduplication', async () => {
      mockAxios.onGet('/api/v1/dashboard/executive-summary').reply(200, {
        total_contracts: 100,
      });

      // Make multiple simultaneous requests for the same data
      const promises = [
        dashboardService.getExecutiveSummary(),
        dashboardService.getExecutiveSummary(),
        dashboardService.getExecutiveSummary(),
      ];

      const results = await Promise.all(promises);

      // Should only make one actual API call
      expect(mockAxios.history.get).toHaveLength(1);
      // All results should be the same
      results.forEach((result) => {
        expect(result.total_contracts).toBe(100);
      });
    });

    it('should invalidate cache on data mutation', async () => {
      mockAxios.onGet('/api/v1/dashboard/executive-summary').reply(200, {
        total_contracts: 100,
      });

      // First call - should hit API
      await dashboardService.getExecutiveSummary();
      
      // Simulate a contract creation that should invalidate cache
      await dashboardService.invalidateCache('executive-summary');
      
      // Second call - should hit API again due to cache invalidation
      await dashboardService.getExecutiveSummary();

      expect(mockAxios.history.get).toHaveLength(2);
    });
  });

  describe('Error handling and resilience', () => {
    it('should handle network timeouts gracefully', async () => {
      mockAxios.onGet('/api/v1/dashboard/executive-summary').timeout();

      await expect(dashboardService.getExecutiveSummary()).rejects.toThrow(
        'Request timeout'
      );
    });

    it('should provide fallback data on service unavailability', async () => {
      mockAxios.onGet('/api/v1/dashboard/executive-summary').reply(503);

      const result = await dashboardService.getExecutiveSummaryWithFallback();

      expect(result).toHaveProperty('total_contracts');
      expect(result.is_fallback).toBe(true);
    });

    it('should log errors for monitoring', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockAxios.onGet('/api/v1/dashboard/executive-summary').reply(500);

      try {
        await dashboardService.getExecutiveSummary();
      } catch (error) {
        // Expected to throw
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Dashboard API Error'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });
});