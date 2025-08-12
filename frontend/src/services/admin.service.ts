/**
 * Admin Service
 * Comprehensive admin functionality for legal AI platform
 * Following TDD methodology - GREEN phase: Making tests pass
 */

import { apiClient } from './apiClient';

// Core admin types
export interface SystemMetrics {
  totalUsers: number;
  totalTenants: number;
  totalContracts: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  uptime: number;
  lastUpdated: string;
}

export interface UserActivity {
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
  ipAddress: string;
  userAgent?: string;
  details?: Record<string, any>;
}

export interface SystemAlert {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: string;
  resolved: boolean;
  source: string;
  details?: Record<string, any>;
}

export interface RecentAction {
  id: string;
  adminUserId: string;
  adminUserName: string;
  action: string;
  targetType: string;
  targetId: string;
  timestamp: string;
  description: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  createdAt: string;
  updatedAt?: string;
  isSystem: boolean;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  resource: string;
  action: string;
}

export interface SystemSettings {
  general: {
    siteName: string;
    timezone: string;
    language: string;
    maintenanceMode: boolean;
  };
  security: {
    sessionTimeout: number;
    maxLoginAttempts: number;
    requireMFA: boolean;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
    };
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    defaultLanguage: string;
  };
  integrations: {
    [key: string]: {
      enabled: boolean;
      config: Record<string, any>;
    };
  };
  lastModified: string;
  modifiedBy: string;
}

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  contactEmail: string;
  plan: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  updatedAt?: string;
  settings?: Record<string, any>;
  limits?: {
    maxUsers: number;
    maxContracts: number;
    maxStorage: number;
  };
}

export interface TenantStats {
  userCount: number;
  contractCount: number;
  documentCount: number;
  storageUsed: number;
  lastActivity: string;
  apiCallsToday: number;
  apiCallsThisMonth: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  lastLogin?: string;
  permissions?: string[];
  profile?: Record<string, any>;
}

export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  userName: string;
  targetType: string;
  targetId: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  result: 'success' | 'failure';
}

export interface AdminAnalytics {
  userGrowth: Array<{
    date: string;
    newUsers: number;
    totalUsers: number;
  }>;
  systemUsage: {
    apiCalls: Array<{ date: string; count: number }>;
    storageUsage: Array<{ date: string; bytes: number }>;
    activeUsers: Array<{ date: string; count: number }>;
  };
  performanceMetrics: {
    averageResponseTime: number;
    errorRate: number;
    uptime: number;
  };
  errorRates: Array<{
    date: string;
    errorCount: number;
    totalRequests: number;
  }>;
}

export interface UsageStatistics {
  totalApiCalls: number;
  activeUsers: number;
  storageUsed: number;
  bandwidthUsed: number;
  topEndpoints: Array<{
    endpoint: string;
    calls: number;
    avgResponseTime: number;
  }>;
  peakUsageHours: Array<{
    hour: number;
    requests: number;
  }>;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'email' | 'sms' | 'push';
  variables: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface SecurityOverview {
  activeSessions: number;
  failedLoginAttempts: number;
  suspiciousActivities: number;
  lastSecurityScan: string;
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  securityScore: number;
}

export interface FailedLogin {
  email: string;
  ipAddress: string;
  timestamp: string;
  reason: string;
  userAgent: string;
  location?: string;
}

export interface SuspiciousActivity {
  userId: string;
  userName: string;
  type: string;
  description: string;
  riskScore: number;
  timestamp: string;
  ipAddress: string;
  details: Record<string, any>;
  status: 'pending' | 'reviewed' | 'dismissed';
}

export interface IntegrationStatus {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  lastChecked: string;
  version?: string;
  latency?: number;
  errorMessage?: string;
}

export interface BulkUserOperation {
  action: 'activate' | 'deactivate' | 'delete' | 'change_role';
  userIds: string[];
  options: {
    newRole?: string;
    reason?: string;
    notifyUsers?: boolean;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class AdminService {
  private readonly baseUrl = '/admin';
  private readonly cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly requestCache = new Map<string, Promise<any>>();

  /**
   * Cache management for performance optimization
   */
  private getCacheKey(endpoint: string, params?: Record<string, any>): string {
    return `${endpoint}:${params ? JSON.stringify(params) : ''}`;
  }

  private getCachedData<T>(cacheKey: string): T | null {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }
    if (cached) {
      this.cache.delete(cacheKey);
    }
    return null;
  }

  private setCachedData<T>(cacheKey: string, data: T, ttl: number = 300000): void { // 5 min default
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Request deduplication to prevent multiple simultaneous requests
   */
  private async deduplicateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.requestCache.has(key)) {
      return this.requestCache.get(key) as Promise<T>;
    }

    const promise = requestFn().finally(() => {
      this.requestCache.delete(key);
    });

    this.requestCache.set(key, promise);
    return promise;
  }

  /**
   * Enhanced error handling with context
   */
  private handleError(error: any, context: string): never {
    const message = error?.response?.data?.detail || error?.message || 'Unknown error';
    const statusCode = error?.response?.status;
    
    console.error(`AdminService Error [${context}]:`, {
      message,
      statusCode,
      timestamp: new Date().toISOString(),
    });

    throw new Error(`Failed to ${context}: ${message}`);
  }

  /**
   * Cache invalidation for data mutations
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      for (const [key] of this.cache) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // 1. Dashboard metrics
  async getSystemMetrics(): Promise<SystemMetrics> {
    const cacheKey = this.getCacheKey('system-metrics');
    const cached = this.getCachedData<SystemMetrics>(cacheKey);
    if (cached) return cached;

    return this.deduplicateRequest(cacheKey, async () => {
      try {
        const response = await apiClient.get(`${this.baseUrl}/metrics/system`);
        this.setCachedData(cacheKey, response.data, 60000); // 1 min cache for metrics
        return response.data;
      } catch (error) {
        this.handleError(error, 'fetch system metrics');
      }
    });
  }

  async getUserActivity(page: number = 1, limit: number = 10): Promise<PaginatedResponse<UserActivity>> {
    const cacheKey = this.getCacheKey('user-activity', { page, limit });
    const cached = this.getCachedData<PaginatedResponse<UserActivity>>(cacheKey);
    if (cached) return cached;

    try {
      const response = await apiClient.get(`${this.baseUrl}/activity/users`, {
        params: { page, limit }
      });
      this.setCachedData(cacheKey, response.data, 120000); // 2 min cache
      return response.data;
    } catch (error) {
      this.handleError(error, 'fetch user activity');
    }
  }

  async getSystemAlerts(severity?: string): Promise<SystemAlert[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/alerts`, {
        params: severity ? { severity } : {}
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'fetch system alerts');
    }
  }

  async getRecentActions(limit: number = 20): Promise<RecentAction[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/actions/recent`, {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'fetch recent actions');
    }
  }

  // 2. Roles management
  async getRoles(): Promise<Role[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/roles`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch roles: ${error}`);
    }
  }

  async createRole(roleData: Omit<Role, 'id' | 'createdAt' | 'updatedAt' | 'isSystem'>): Promise<Role> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/roles`, roleData);
      // Invalidate roles cache after creation
      this.clearCache('roles');
      return response.data;
    } catch (error) {
      this.handleError(error, 'create role');
    }
  }

  async updateRole(roleId: string, updateData: Partial<Omit<Role, 'id' | 'createdAt' | 'isSystem'>>): Promise<Role> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/roles/${roleId}`, updateData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update role: ${error}`);
    }
  }

  async deleteRole(roleId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.delete(`${this.baseUrl}/roles/${roleId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to delete role: ${error}`);
    }
  }

  async getPermissions(): Promise<Permission[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/permissions`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch permissions: ${error}`);
    }
  }

  async updatePermissions(roleId: string, permissions: string[]): Promise<{ success: boolean; updatedPermissions: string[] }> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/roles/${roleId}/permissions`, {
        permissions
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update permissions: ${error}`);
    }
  }

  // 3. System settings
  async getSettings(): Promise<SystemSettings> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/settings`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch system settings: ${error}`);
    }
  }

  async updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/settings`, settings);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update system settings: ${error}`);
    }
  }

  async testConnection(serviceName: string): Promise<{ success: boolean; message: string; latency: number }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/settings/test-connection`, {
        service: serviceName
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to test connection: ${error}`);
    }
  }

  async importSettings(settingsData: Record<string, any>): Promise<{ success: boolean; importedKeys: string[] }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/settings/import`, settingsData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to import settings: ${error}`);
    }
  }

  async exportSettings(): Promise<SystemSettings & { exportTimestamp: string }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/settings/export`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to export settings: ${error}`);
    }
  }

  // 4. Tenant management
  async getTenants(page: number = 1, limit: number = 10): Promise<PaginatedResponse<Tenant>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/tenants`, {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch tenants: ${error}`);
    }
  }

  async createTenant(tenantData: Omit<Tenant, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Tenant> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/tenants`, tenantData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create tenant: ${error}`);
    }
  }

  async updateTenant(tenantId: string, updateData: Partial<Omit<Tenant, 'id' | 'createdAt'>>): Promise<Tenant> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/tenants/${tenantId}`, updateData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update tenant: ${error}`);
    }
  }

  async deleteTenant(tenantId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.delete(`${this.baseUrl}/tenants/${tenantId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to delete tenant: ${error}`);
    }
  }

  async getTenantStats(tenantId: string): Promise<TenantStats> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/tenants/${tenantId}/stats`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch tenant stats: ${error}`);
    }
  }

  async exportTenantData(tenantId: string): Promise<{
    tenantInfo: Tenant;
    users: User[];
    contracts: any[];
    exportTimestamp: string;
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/tenants/${tenantId}/export`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to export tenant data: ${error}`);
    }
  }

  // 5. User management
  async getUsers(page: number = 1, limit: number = 10, filters?: Record<string, any>): Promise<PaginatedResponse<User>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/users`, {
        params: { page, limit, ...filters }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch users: ${error}`);
    }
  }

  async createUser(userData: Omit<User, 'id' | 'status' | 'createdAt' | 'lastLogin'>): Promise<User> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/users`, userData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create user: ${error}`);
    }
  }

  async updateUser(userId: string, updateData: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/users/${userId}`, updateData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update user: ${error}`);
    }
  }

  async deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.delete(`${this.baseUrl}/users/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to delete user: ${error}`);
    }
  }

  async resetPassword(userId: string): Promise<{ success: boolean; temporaryPassword: string; expiresAt: string }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/users/${userId}/reset-password`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to reset password: ${error}`);
    }
  }

  async bulkUserOperation(operation: BulkUserOperation): Promise<{
    success: boolean;
    processedCount: number;
    failedCount: number;
    results: Array<{ userId: string; success: boolean; error?: string }>;
  }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/users/bulk`, operation);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to perform bulk user operation: ${error}`);
    }
  }

  // 6. Audit logging
  async getAuditLogs(page: number = 1, limit: number = 20, filters?: Record<string, any>): Promise<PaginatedResponse<AuditLog>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/audit/logs`, {
        params: { page, limit, ...filters }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch audit logs: ${error}`);
    }
  }

  async logAction(actionData: {
    action: string;
    targetType: string;
    targetId: string;
    details?: Record<string, any>;
  }): Promise<{ success: boolean; logId: string }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/audit/log`, actionData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to log action: ${error}`);
    }
  }

  async getActivityTimeline(entityType: string, entityId: string): Promise<AuditLog[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/audit/timeline`, {
        params: { entityType, entityId }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch activity timeline: ${error}`);
    }
  }

  // 7. System operations
  async backupSystem(options: {
    includeUserData?: boolean;
    includeSystemSettings?: boolean;
    compression?: string;
  }): Promise<{ success: boolean; backupId: string; estimatedSize: number }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/system/backup`, options);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to initiate system backup: ${error}`);
    }
  }

  async clearCache(cacheType: string): Promise<{ success: boolean; clearedKeys: number }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/system/clear-cache`, {
        cacheType
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to clear cache: ${error}`);
    }
  }

  async restartService(serviceName: string): Promise<{ success: boolean; message: string; restartTime: string }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/system/restart-service`, {
        serviceName
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to restart service: ${error}`);
    }
  }

  async getIntegrationStatus(): Promise<IntegrationStatus[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/system/integrations/status`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch integration status: ${error}`);
    }
  }

  // 8. Analytics
  async getAdminAnalytics(dateRange?: { start: string; end: string }): Promise<AdminAnalytics> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/analytics`, {
        params: dateRange ? { startDate: dateRange.start, endDate: dateRange.end } : {}
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch admin analytics: ${error}`);
    }
  }

  async generateReport(config: {
    type: string;
    dateRange: { start: string; end: string };
    filters?: Record<string, any>;
  }): Promise<{
    id: string;
    status: string;
    data: any;
    generatedAt: string;
  }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/analytics/report`, config);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to generate report: ${error}`);
    }
  }

  async getUsageStatistics(): Promise<UsageStatistics> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/analytics/usage`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch usage statistics: ${error}`);
    }
  }

  // 9. Notifications
  async sendBroadcast(broadcast: {
    title: string;
    message: string;
    type: string;
    targetAudience: string;
  }): Promise<{ success: boolean; notificationId: string; recipientCount: number }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/notifications/broadcast`, broadcast);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to send broadcast: ${error}`);
    }
  }

  async getNotificationTemplates(): Promise<NotificationTemplate[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/notifications/templates`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch notification templates: ${error}`);
    }
  }

  async updateNotificationSettings(settings: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    defaultLanguage: string;
  }): Promise<{ success: boolean; updatedSettings: any }> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/notifications/settings`, settings);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update notification settings: ${error}`);
    }
  }

  // 10. Security
  async getSecurityOverview(): Promise<SecurityOverview> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/security/overview`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch security overview: ${error}`);
    }
  }

  async getFailedLogins(hours: number = 24): Promise<FailedLogin[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/security/failed-logins`, {
        params: { hours }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch failed logins: ${error}`);
    }
  }

  async getSuspiciousActivity(): Promise<SuspiciousActivity[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/security/suspicious-activity`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch suspicious activity: ${error}`);
    }
  }

  async runSecurityScan(options: {
    scanType: string;
    includeVulnerabilities?: boolean;
  }): Promise<{ success: boolean; scanId: string; estimatedDuration: number }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/security/scan`, options);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to run security scan: ${error}`);
    }
  }
}

// Export singleton instance
export const adminService = new AdminService();
export default adminService;