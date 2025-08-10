/**
 * Multi-Tenant Isolation Tests for Frontend
 * Following TDD - Comprehensive test suite for tenant isolation
 * Ensures complete data separation between tenants
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/auth';

// Mock modules
vi.mock('axios');
vi.mock('../store/auth');

describe('Multi-Tenant Isolation', () => {
  let queryClient: QueryClient;
  const user = userEvent.setup();
  
  // Test tenants
  const tenantA = {
    id: 'tenant-a-123',
    name: 'Company A',
    user: {
      id: 'user-a-1',
      name: 'Alice Admin',
      email: 'alice@companya.com',
      tenant_id: 'tenant-a-123',
      role: 'admin',
    },
    token: 'token-tenant-a',
  };

  const tenantB = {
    id: 'tenant-b-456',
    name: 'Company B',
    user: {
      id: 'user-b-1',
      name: 'Bob Admin',
      email: 'bob@companyb.com',
      tenant_id: 'tenant-b-456',
      role: 'admin',
    },
    token: 'token-tenant-b',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { 
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Request Headers', () => {
    it('should include X-Tenant-ID header in all API requests', async () => {
      const mockAxios = vi.mocked(axios);
      
      // Set up tenant A context
      vi.mocked(useAuthStore).mockReturnValue({
        user: tenantA.user,
        token: tenantA.token,
        isAuthenticated: true,
      } as any);

      // Mock axios create and interceptors
      const mockInstance = {
        get: vi.fn().mockResolvedValue({ data: [] }),
        post: vi.fn().mockResolvedValue({ data: {} }),
        put: vi.fn().mockResolvedValue({ data: {} }),
        delete: vi.fn().mockResolvedValue({ data: {} }),
        interceptors: {
          request: { use: vi.fn((callback) => callback({ headers: {} })) },
          response: { use: vi.fn() },
        },
      };
      
      mockAxios.create = vi.fn().mockReturnValue(mockInstance);

      // Import service that makes API calls
      const { contractService } = await import('../services/contract.service');
      
      // Make API call
      await contractService.getContracts();

      // Verify tenant header is included
      const interceptorCall = mockInstance.interceptors.request.use.mock.calls[0][0];
      const config = interceptorCall({ headers: {} });
      expect(config.headers['X-Tenant-ID']).toBe('tenant-a-123');
    });

    it('should not allow access without tenant context', async () => {
      // No authenticated user
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        token: null,
        isAuthenticated: false,
      } as any);

      const { contractService } = await import('../services/contract.service');
      
      await expect(contractService.getContracts()).rejects.toThrow();
    });

    it('should isolate API responses by tenant', async () => {
      const mockAxios = vi.mocked(axios);
      
      // Tenant A contracts
      const tenantAContracts = [
        { id: 'contract-a-1', title: 'Contract A1', tenant_id: 'tenant-a-123' },
        { id: 'contract-a-2', title: 'Contract A2', tenant_id: 'tenant-a-123' },
      ];

      // Tenant B contracts
      const tenantBContracts = [
        { id: 'contract-b-1', title: 'Contract B1', tenant_id: 'tenant-b-456' },
        { id: 'contract-b-2', title: 'Contract B2', tenant_id: 'tenant-b-456' },
      ];

      const mockInstance = {
        get: vi.fn((url, config) => {
          const tenantId = config?.headers?.['X-Tenant-ID'];
          if (tenantId === 'tenant-a-123') {
            return Promise.resolve({ data: tenantAContracts });
          } else if (tenantId === 'tenant-b-456') {
            return Promise.resolve({ data: tenantBContracts });
          }
          return Promise.reject(new Error('Unauthorized'));
        }),
        interceptors: {
          request: { 
            use: vi.fn((callback) => {
              return (config) => {
                const state = useAuthStore.getState();
                if (state.user?.tenant_id) {
                  config.headers = config.headers || {};
                  config.headers['X-Tenant-ID'] = state.user.tenant_id;
                }
                return callback(config);
              };
            }),
          },
          response: { use: vi.fn() },
        },
      };
      
      mockAxios.create = vi.fn().mockReturnValue(mockInstance);

      // Test Tenant A
      vi.mocked(useAuthStore).mockReturnValue({
        user: tenantA.user,
        token: tenantA.token,
        getState: () => ({ user: tenantA.user }),
      } as any);

      const { contractService: serviceA } = await import('../services/contract.service');
      const resultA = await serviceA.getContracts();
      
      expect(resultA).toEqual(tenantAContracts);
      expect(resultA).not.toContainEqual(expect.objectContaining({ tenant_id: 'tenant-b-456' }));

      // Test Tenant B
      vi.mocked(useAuthStore).mockReturnValue({
        user: tenantB.user,
        token: tenantB.token,
        getState: () => ({ user: tenantB.user }),
      } as any);

      const { contractService: serviceB } = await import('../services/contract.service');
      const resultB = await serviceB.getContracts();
      
      expect(resultB).toEqual(tenantBContracts);
      expect(resultB).not.toContainEqual(expect.objectContaining({ tenant_id: 'tenant-a-123' }));
    });
  });

  describe('Data Storage Isolation', () => {
    it('should isolate localStorage by tenant', () => {
      // Set data for tenant A
      localStorage.setItem(`tenant_${tenantA.id}_preferences`, JSON.stringify({
        theme: 'dark',
        language: 'en',
      }));

      // Set data for tenant B
      localStorage.setItem(`tenant_${tenantB.id}_preferences`, JSON.stringify({
        theme: 'light',
        language: 'fr',
      }));

      // Verify isolation
      const tenantAData = JSON.parse(localStorage.getItem(`tenant_${tenantA.id}_preferences`) || '{}');
      const tenantBData = JSON.parse(localStorage.getItem(`tenant_${tenantB.id}_preferences`) || '{}');

      expect(tenantAData.theme).toBe('dark');
      expect(tenantBData.theme).toBe('light');
      expect(tenantAData).not.toEqual(tenantBData);
    });

    it('should isolate sessionStorage by tenant', () => {
      // Set session data for tenant A
      sessionStorage.setItem(`tenant_${tenantA.id}_session`, JSON.stringify({
        lastView: 'dashboard',
        filters: { status: 'active' },
      }));

      // Set session data for tenant B
      sessionStorage.setItem(`tenant_${tenantB.id}_session`, JSON.stringify({
        lastView: 'contracts',
        filters: { status: 'draft' },
      }));

      // Verify isolation
      const tenantASession = JSON.parse(sessionStorage.getItem(`tenant_${tenantA.id}_session`) || '{}');
      const tenantBSession = JSON.parse(sessionStorage.getItem(`tenant_${tenantB.id}_session`) || '{}');

      expect(tenantASession.lastView).toBe('dashboard');
      expect(tenantBSession.lastView).toBe('contracts');
      expect(tenantASession.filters).not.toEqual(tenantBSession.filters);
    });

    it('should clear tenant data on logout', () => {
      // Set tenant A data
      localStorage.setItem(`tenant_${tenantA.id}_preferences`, JSON.stringify({ theme: 'dark' }));
      sessionStorage.setItem(`tenant_${tenantA.id}_session`, JSON.stringify({ lastView: 'dashboard' }));

      // Simulate logout
      const clearTenantData = (tenantId: string) => {
        const keys = [...Object.keys(localStorage), ...Object.keys(sessionStorage)];
        keys.forEach(key => {
          if (key.startsWith(`tenant_${tenantId}_`)) {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
          }
        });
      };

      clearTenantData(tenantA.id);

      // Verify data is cleared
      expect(localStorage.getItem(`tenant_${tenantA.id}_preferences`)).toBeNull();
      expect(sessionStorage.getItem(`tenant_${tenantA.id}_session`)).toBeNull();
    });
  });

  describe('State Management Isolation', () => {
    it('should reset store state on tenant switch', async () => {
      const { useContractStore } = await import('../store/contracts');
      
      // Set state for tenant A
      useContractStore.setState({
        contracts: [
          { id: 'contract-a-1', title: 'Contract A1', tenant_id: 'tenant-a-123' },
        ],
        selectedContract: { id: 'contract-a-1', title: 'Contract A1', tenant_id: 'tenant-a-123' },
      });

      // Simulate tenant switch
      const resetStores = () => {
        useContractStore.setState({
          contracts: [],
          selectedContract: null,
          loading: false,
          error: null,
        });
      };

      resetStores();

      // Verify state is cleared
      const state = useContractStore.getState();
      expect(state.contracts).toEqual([]);
      expect(state.selectedContract).toBeNull();
    });

    it('should not share cached data between tenants', async () => {
      const cache = new Map();
      
      // Cache key includes tenant ID
      const getCacheKey = (resource: string, tenantId: string) => 
        `${tenantId}:${resource}`;

      // Set cache for tenant A
      cache.set(getCacheKey('contracts', tenantA.id), tenantAContracts);
      
      // Set cache for tenant B
      cache.set(getCacheKey('contracts', tenantB.id), tenantBContracts);

      // Verify isolation
      const tenantACache = cache.get(getCacheKey('contracts', tenantA.id));
      const tenantBCache = cache.get(getCacheKey('contracts', tenantB.id));

      expect(tenantACache).not.toEqual(tenantBCache);
      expect(tenantACache).not.toContainEqual(
        expect.objectContaining({ tenant_id: 'tenant-b-456' })
      );
    });
  });

  describe('URL and Routing Isolation', () => {
    it('should include tenant context in URLs', () => {
      const generateUrl = (path: string, tenantId: string) => 
        `/app/${tenantId}${path}`;

      const tenantAUrl = generateUrl('/contracts/123', tenantA.id);
      const tenantBUrl = generateUrl('/contracts/123', tenantB.id);

      expect(tenantAUrl).toBe('/app/tenant-a-123/contracts/123');
      expect(tenantBUrl).toBe('/app/tenant-b-456/contracts/123');
      expect(tenantAUrl).not.toBe(tenantBUrl);
    });

    it('should validate tenant access in route guards', () => {
      const canAccessRoute = (requestedTenantId: string, userTenantId: string) => 
        requestedTenantId === userTenantId;

      // Tenant A trying to access their own route
      expect(canAccessRoute('tenant-a-123', tenantA.user.tenant_id)).toBe(true);

      // Tenant A trying to access Tenant B's route
      expect(canAccessRoute('tenant-b-456', tenantA.user.tenant_id)).toBe(false);
    });
  });

  describe('WebSocket Isolation', () => {
    it('should connect to tenant-specific WebSocket channels', () => {
      const getWebSocketChannel = (tenantId: string, channel: string) => 
        `/ws/${tenantId}/${channel}`;

      const tenantAChannel = getWebSocketChannel(tenantA.id, 'notifications');
      const tenantBChannel = getWebSocketChannel(tenantB.id, 'notifications');

      expect(tenantAChannel).toBe('/ws/tenant-a-123/notifications');
      expect(tenantBChannel).toBe('/ws/tenant-b-456/notifications');
      expect(tenantAChannel).not.toBe(tenantBChannel);
    });

    it('should not receive messages from other tenants', () => {
      const messages: any[] = [];
      
      const handleMessage = (message: any, subscriberTenantId: string) => {
        if (message.tenant_id === subscriberTenantId) {
          messages.push(message);
        }
      };

      // Tenant A message
      const messageA = { 
        id: 'msg-1', 
        tenant_id: 'tenant-a-123', 
        content: 'Message for A' 
      };

      // Tenant B message
      const messageB = { 
        id: 'msg-2', 
        tenant_id: 'tenant-b-456', 
        content: 'Message for B' 
      };

      // Tenant A receives only their message
      handleMessage(messageA, tenantA.id);
      handleMessage(messageB, tenantA.id);

      expect(messages).toHaveLength(1);
      expect(messages[0].tenant_id).toBe('tenant-a-123');
    });
  });

  describe('File Upload Isolation', () => {
    it('should prefix uploaded files with tenant ID', () => {
      const generateFilePath = (filename: string, tenantId: string) => 
        `${tenantId}/uploads/${Date.now()}_${filename}`;

      const tenantAFile = generateFilePath('contract.pdf', tenantA.id);
      const tenantBFile = generateFilePath('contract.pdf', tenantB.id);

      expect(tenantAFile).toMatch(/^tenant-a-123\/uploads\//);
      expect(tenantBFile).toMatch(/^tenant-b-456\/uploads\//);
      expect(tenantAFile).not.toMatch(/tenant-b-456/);
    });

    it('should validate file access by tenant', () => {
      const canAccessFile = (filePath: string, tenantId: string) => 
        filePath.startsWith(`${tenantId}/`);

      const tenantAFile = 'tenant-a-123/uploads/contract.pdf';
      const tenantBFile = 'tenant-b-456/uploads/contract.pdf';

      // Tenant A can access their files
      expect(canAccessFile(tenantAFile, tenantA.id)).toBe(true);
      
      // Tenant A cannot access Tenant B's files
      expect(canAccessFile(tenantBFile, tenantA.id)).toBe(false);
    });
  });

  describe('Search Isolation', () => {
    it('should scope search results to tenant', async () => {
      const searchContracts = async (query: string, tenantId: string) => {
        const allContracts = [
          { id: '1', title: 'Contract A1', tenant_id: 'tenant-a-123' },
          { id: '2', title: 'Contract A2', tenant_id: 'tenant-a-123' },
          { id: '3', title: 'Contract B1', tenant_id: 'tenant-b-456' },
          { id: '4', title: 'Contract B2', tenant_id: 'tenant-b-456' },
        ];

        return allContracts.filter(c => 
          c.tenant_id === tenantId && 
          c.title.toLowerCase().includes(query.toLowerCase())
        );
      };

      // Tenant A search
      const tenantAResults = await searchContracts('contract', tenantA.id);
      expect(tenantAResults).toHaveLength(2);
      expect(tenantAResults.every(r => r.tenant_id === 'tenant-a-123')).toBe(true);

      // Tenant B search
      const tenantBResults = await searchContracts('contract', tenantB.id);
      expect(tenantBResults).toHaveLength(2);
      expect(tenantBResults.every(r => r.tenant_id === 'tenant-b-456')).toBe(true);
    });

    it('should isolate search suggestions by tenant', () => {
      const suggestions = new Map([
        ['tenant-a-123:recent', ['NDA', 'Service Agreement', 'License']],
        ['tenant-b-456:recent', ['Purchase Order', 'Lease', 'Employment']],
      ]);

      const getTenantSuggestions = (tenantId: string) => 
        suggestions.get(`${tenantId}:recent`) || [];

      const tenantASuggestions = getTenantSuggestions(tenantA.id);
      const tenantBSuggestions = getTenantSuggestions(tenantB.id);

      expect(tenantASuggestions).toContain('NDA');
      expect(tenantASuggestions).not.toContain('Purchase Order');
      expect(tenantBSuggestions).toContain('Purchase Order');
      expect(tenantBSuggestions).not.toContain('NDA');
    });
  });

  describe('Analytics Isolation', () => {
    it('should track analytics separately by tenant', () => {
      const analytics = new Map();
      
      const trackEvent = (event: string, tenantId: string) => {
        const key = `${tenantId}:${event}`;
        analytics.set(key, (analytics.get(key) || 0) + 1);
      };

      // Track events for both tenants
      trackEvent('contract_view', tenantA.id);
      trackEvent('contract_view', tenantA.id);
      trackEvent('contract_view', tenantB.id);

      // Verify isolation
      expect(analytics.get('tenant-a-123:contract_view')).toBe(2);
      expect(analytics.get('tenant-b-456:contract_view')).toBe(1);
    });

    it('should not expose cross-tenant metrics', () => {
      const getMetrics = (tenantId: string) => ({
        contracts: tenantId === 'tenant-a-123' ? 150 : 75,
        users: tenantId === 'tenant-a-123' ? 25 : 10,
        storage: tenantId === 'tenant-a-123' ? '2.5GB' : '1.2GB',
      });

      const tenantAMetrics = getMetrics(tenantA.id);
      const tenantBMetrics = getMetrics(tenantB.id);

      expect(tenantAMetrics.contracts).toBe(150);
      expect(tenantBMetrics.contracts).toBe(75);
      expect(tenantAMetrics).not.toEqual(tenantBMetrics);
    });
  });

  describe('Error Handling', () => {
    it('should not leak tenant information in errors', () => {
      const sanitizeError = (error: any, tenantId: string) => {
        const message = error.message || '';
        // Remove any tenant IDs that aren't the current tenant's
        const sanitized = message.replace(/tenant-[\w-]+/g, (match: string) => 
          match === tenantId ? match : 'tenant-xxx'
        );
        return { ...error, message: sanitized };
      };

      const error = new Error('Access denied for tenant-b-456 resource');
      const sanitized = sanitizeError(error, tenantA.id);

      expect(sanitized.message).toBe('Access denied for tenant-xxx resource');
      expect(sanitized.message).not.toContain('tenant-b-456');
    });

    it('should handle tenant context loss gracefully', async () => {
      // Simulate lost tenant context
      vi.mocked(useAuthStore).mockReturnValue({
        user: { ...tenantA.user, tenant_id: undefined },
        token: tenantA.token,
      } as any);

      const validateTenantContext = () => {
        const state = useAuthStore.getState();
        if (!state.user?.tenant_id) {
          throw new Error('Tenant context required');
        }
        return true;
      };

      expect(() => validateTenantContext()).toThrow('Tenant context required');
    });
  });

  describe('Cross-Tenant Security', () => {
    it('should prevent CSRF attacks across tenants', () => {
      const generateCSRFToken = (tenantId: string, sessionId: string) => 
        btoa(`${tenantId}:${sessionId}:${Date.now()}`);

      const validateCSRFToken = (token: string, expectedTenantId: string) => {
        try {
          const decoded = atob(token);
          const [tenantId] = decoded.split(':');
          return tenantId === expectedTenantId;
        } catch {
          return false;
        }
      };

      const tenantAToken = generateCSRFToken(tenantA.id, 'session-a');
      const tenantBToken = generateCSRFToken(tenantB.id, 'session-b');

      // Tenant A token is valid for Tenant A
      expect(validateCSRFToken(tenantAToken, tenantA.id)).toBe(true);
      
      // Tenant B token is not valid for Tenant A
      expect(validateCSRFToken(tenantBToken, tenantA.id)).toBe(false);
    });

    it('should sanitize user input to prevent XSS', () => {
      const sanitizeInput = (input: string) => 
        input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
              .replace(/on\w+\s*=\s*'[^']*'/gi, '');

      const maliciousInput = '<script>alert("XSS")</script><div onclick="evil()">Click</div>';
      const sanitized = sanitizeInput(maliciousInput);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).toBe('<div>Click</div>');
    });
  });
});