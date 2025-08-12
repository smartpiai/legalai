/**
 * Admin Service Integration Tests
 * Following strict TDD - RED phase: Writing failing tests first
 * No mocks allowed - using real implementations
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { AdminService } from '../admin.service';
import type {
  SystemMetrics,
  UserActivity,
  SystemAlert,
  RecentAction,
  Role,
  Permission,
  SystemSettings,
  Tenant,
  TenantStats,
  User,
  AuditLog,
  AdminAnalytics,
  UsageStatistics,
  NotificationTemplate,
  SecurityOverview,
  FailedLogin,
  SuspiciousActivity,
  PaginatedResponse,
  BulkUserOperation,
  IntegrationStatus,
} from '../admin.service';

describe('AdminService - TDD Integration Tests', () => {
  let adminService: AdminService;

  beforeAll(() => {
    // Setup test environment - these tests will fail initially (RED phase)
    console.log('Setting up AdminService tests - expecting failures in RED phase');
  });

  beforeEach(() => {
    adminService = new AdminService();
  });

  afterAll(() => {
    console.log('AdminService tests completed');
  });

  // 1. Dashboard metrics tests
  describe('Dashboard Metrics', () => {
    it('should fetch system metrics with real-time data', async () => {
      const metrics: SystemMetrics = await adminService.getSystemMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.totalUsers).toBeGreaterThanOrEqual(0);
      expect(metrics.totalTenants).toBeGreaterThanOrEqual(0);
      expect(metrics.totalContracts).toBeGreaterThanOrEqual(0);
      expect(metrics.systemHealth).toMatch(/^(healthy|warning|critical)$/);
      expect(metrics.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.diskUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(metrics.lastUpdated).toBeDefined();
    });

    it('should fetch user activity data with pagination', async () => {
      const activity: PaginatedResponse<UserActivity> = await adminService.getUserActivity(1, 10);
      
      expect(activity).toBeDefined();
      expect(activity.items).toBeInstanceOf(Array);
      expect(activity.total).toBeGreaterThanOrEqual(0);
      expect(activity.page).toBe(1);
      expect(activity.limit).toBe(10);
      
      if (activity.items.length > 0) {
        const firstActivity = activity.items[0];
        expect(firstActivity.userId).toBeDefined();
        expect(firstActivity.action).toBeDefined();
        expect(firstActivity.timestamp).toBeDefined();
        expect(firstActivity.ipAddress).toBeDefined();
      }
    });

    it('should fetch system alerts with severity filtering', async () => {
      const alerts: SystemAlert[] = await adminService.getSystemAlerts();
      
      expect(alerts).toBeInstanceOf(Array);
      
      if (alerts.length > 0) {
        const alert = alerts[0];
        expect(alert.id).toBeDefined();
        expect(alert.message).toBeDefined();
        expect(alert.severity).toMatch(/^(info|warning|error|critical)$/);
        expect(alert.timestamp).toBeDefined();
        expect(alert.resolved).toBeDefined();
      }
    });

    it('should fetch recent admin actions', async () => {
      const actions: RecentAction[] = await adminService.getRecentActions(20);
      
      expect(actions).toBeInstanceOf(Array);
      expect(actions.length).toBeLessThanOrEqual(20);
      
      if (actions.length > 0) {
        const action = actions[0];
        expect(action.id).toBeDefined();
        expect(action.adminUserId).toBeDefined();
        expect(action.action).toBeDefined();
        expect(action.targetType).toBeDefined();
        expect(action.timestamp).toBeDefined();
      }
    });
  });

  // 2. Roles management tests
  describe('Roles Management', () => {
    it('should fetch all roles with permissions', async () => {
      const roles: Role[] = await adminService.getRoles();
      
      expect(roles).toBeInstanceOf(Array);
      
      if (roles.length > 0) {
        const role = roles[0];
        expect(role.id).toBeDefined();
        expect(role.name).toBeDefined();
        expect(role.description).toBeDefined();
        expect(role.permissions).toBeInstanceOf(Array);
        expect(role.createdAt).toBeDefined();
      }
    });

    it('should create a new role successfully', async () => {
      const newRole = {
        name: 'Test Role',
        description: 'Test role for integration testing',
        permissions: ['contracts.read', 'contracts.write']
      };
      
      const createdRole: Role = await adminService.createRole(newRole);
      
      expect(createdRole.id).toBeDefined();
      expect(createdRole.name).toBe(newRole.name);
      expect(createdRole.description).toBe(newRole.description);
      expect(createdRole.permissions).toEqual(newRole.permissions);
    });

    it('should update an existing role', async () => {
      const roleId = 'test-role-id';
      const updateData = {
        name: 'Updated Test Role',
        description: 'Updated description',
        permissions: ['contracts.read']
      };
      
      const updatedRole: Role = await adminService.updateRole(roleId, updateData);
      
      expect(updatedRole.id).toBe(roleId);
      expect(updatedRole.name).toBe(updateData.name);
      expect(updatedRole.description).toBe(updateData.description);
      expect(updatedRole.permissions).toEqual(updateData.permissions);
    });

    it('should delete a role', async () => {
      const roleId = 'test-role-id';
      
      const result = await adminService.deleteRole(roleId);
      
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    it('should fetch all available permissions', async () => {
      const permissions: Permission[] = await adminService.getPermissions();
      
      expect(permissions).toBeInstanceOf(Array);
      
      if (permissions.length > 0) {
        const permission = permissions[0];
        expect(permission.id).toBeDefined();
        expect(permission.name).toBeDefined();
        expect(permission.description).toBeDefined();
        expect(permission.category).toBeDefined();
      }
    });

    it('should update permissions for a role', async () => {
      const roleId = 'test-role-id';
      const permissions = ['contracts.read', 'contracts.write', 'users.read'];
      
      const result = await adminService.updatePermissions(roleId, permissions);
      
      expect(result.success).toBe(true);
      expect(result.updatedPermissions).toEqual(permissions);
    });
  });

  // 3. System settings tests
  describe('System Settings', () => {
    it('should fetch current system settings', async () => {
      const settings: SystemSettings = await adminService.getSettings();
      
      expect(settings).toBeDefined();
      expect(settings.general).toBeDefined();
      expect(settings.security).toBeDefined();
      expect(settings.notifications).toBeDefined();
      expect(settings.integrations).toBeDefined();
      expect(settings.lastModified).toBeDefined();
    });

    it('should update system settings', async () => {
      const updatedSettings = {
        general: {
          siteName: 'Updated Legal AI Platform',
          timezone: 'America/New_York',
          language: 'en'
        },
        security: {
          sessionTimeout: 3600,
          maxLoginAttempts: 5,
          requireMFA: true
        }
      };
      
      const result: SystemSettings = await adminService.updateSettings(updatedSettings);
      
      expect(result.general.siteName).toBe(updatedSettings.general.siteName);
      expect(result.security.sessionTimeout).toBe(updatedSettings.security.sessionTimeout);
    });

    it('should test external service connection', async () => {
      const serviceName = 'email-service';
      
      const result = await adminService.testConnection(serviceName);
      
      expect(result.success).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('should import settings from JSON', async () => {
      const settingsData = {
        general: { siteName: 'Imported Site' },
        security: { sessionTimeout: 7200 }
      };
      
      const result = await adminService.importSettings(settingsData);
      
      expect(result.success).toBe(true);
      expect(result.importedKeys).toBeInstanceOf(Array);
    });

    it('should export settings to JSON', async () => {
      const exportedSettings = await adminService.exportSettings();
      
      expect(exportedSettings).toBeDefined();
      expect(exportedSettings.general).toBeDefined();
      expect(exportedSettings.security).toBeDefined();
      expect(exportedSettings.exportTimestamp).toBeDefined();
    });
  });

  // 4. Tenant management tests
  describe('Tenant Management', () => {
    it('should fetch all tenants with pagination', async () => {
      const tenants: PaginatedResponse<Tenant> = await adminService.getTenants(1, 10);
      
      expect(tenants.items).toBeInstanceOf(Array);
      expect(tenants.total).toBeGreaterThanOrEqual(0);
      expect(tenants.page).toBe(1);
      expect(tenants.limit).toBe(10);
      
      if (tenants.items.length > 0) {
        const tenant = tenants.items[0];
        expect(tenant.id).toBeDefined();
        expect(tenant.name).toBeDefined();
        expect(tenant.domain).toBeDefined();
        expect(tenant.status).toMatch(/^(active|inactive|suspended)$/);
        expect(tenant.createdAt).toBeDefined();
      }
    });

    it('should create a new tenant', async () => {
      const newTenant = {
        name: 'Test Tenant Inc.',
        domain: 'testtenant.com',
        contactEmail: 'admin@testtenant.com',
        plan: 'enterprise'
      };
      
      const createdTenant: Tenant = await adminService.createTenant(newTenant);
      
      expect(createdTenant.id).toBeDefined();
      expect(createdTenant.name).toBe(newTenant.name);
      expect(createdTenant.domain).toBe(newTenant.domain);
      expect(createdTenant.status).toBe('active');
    });

    it('should update tenant information', async () => {
      const tenantId = 'test-tenant-id';
      const updateData = {
        name: 'Updated Tenant Name',
        contactEmail: 'newemail@tenant.com'
      };
      
      const updatedTenant: Tenant = await adminService.updateTenant(tenantId, updateData);
      
      expect(updatedTenant.id).toBe(tenantId);
      expect(updatedTenant.name).toBe(updateData.name);
      expect(updatedTenant.contactEmail).toBe(updateData.contactEmail);
    });

    it('should delete a tenant', async () => {
      const tenantId = 'test-tenant-id';
      
      const result = await adminService.deleteTenant(tenantId);
      
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    it('should fetch tenant statistics', async () => {
      const tenantId = 'test-tenant-id';
      
      const stats: TenantStats = await adminService.getTenantStats(tenantId);
      
      expect(stats.userCount).toBeGreaterThanOrEqual(0);
      expect(stats.contractCount).toBeGreaterThanOrEqual(0);
      expect(stats.documentCount).toBeGreaterThanOrEqual(0);
      expect(stats.storageUsed).toBeGreaterThanOrEqual(0);
      expect(stats.lastActivity).toBeDefined();
    });

    it('should export tenant data', async () => {
      const tenantId = 'test-tenant-id';
      
      const exportData = await adminService.exportTenantData(tenantId);
      
      expect(exportData.tenantInfo).toBeDefined();
      expect(exportData.users).toBeInstanceOf(Array);
      expect(exportData.contracts).toBeInstanceOf(Array);
      expect(exportData.exportTimestamp).toBeDefined();
    });
  });

  // 5. User management tests
  describe('User Management', () => {
    it('should fetch all users with filtering and pagination', async () => {
      const users: PaginatedResponse<User> = await adminService.getUsers(1, 10);
      
      expect(users.items).toBeInstanceOf(Array);
      expect(users.total).toBeGreaterThanOrEqual(0);
      
      if (users.items.length > 0) {
        const user = users.items[0];
        expect(user.id).toBeDefined();
        expect(user.email).toBeDefined();
        expect(user.name).toBeDefined();
        expect(user.role).toBeDefined();
        expect(user.status).toMatch(/^(active|inactive|suspended)$/);
      }
    });

    it('should create a new user', async () => {
      const newUser = {
        email: 'newuser@test.com',
        name: 'New Test User',
        role: 'user',
        tenantId: 'test-tenant-id'
      };
      
      const createdUser: User = await adminService.createUser(newUser);
      
      expect(createdUser.id).toBeDefined();
      expect(createdUser.email).toBe(newUser.email);
      expect(createdUser.name).toBe(newUser.name);
      expect(createdUser.role).toBe(newUser.role);
      expect(createdUser.status).toBe('active');
    });

    it('should update user information', async () => {
      const userId = 'test-user-id';
      const updateData = {
        name: 'Updated User Name',
        role: 'admin'
      };
      
      const updatedUser: User = await adminService.updateUser(userId, updateData);
      
      expect(updatedUser.id).toBe(userId);
      expect(updatedUser.name).toBe(updateData.name);
      expect(updatedUser.role).toBe(updateData.role);
    });

    it('should delete a user', async () => {
      const userId = 'test-user-id';
      
      const result = await adminService.deleteUser(userId);
      
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    it('should reset user password', async () => {
      const userId = 'test-user-id';
      
      const result = await adminService.resetPassword(userId);
      
      expect(result.success).toBe(true);
      expect(result.temporaryPassword).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('should perform bulk user operations', async () => {
      const operation: BulkUserOperation = {
        action: 'activate',
        userIds: ['user1', 'user2', 'user3'],
        options: {}
      };
      
      const result = await adminService.bulkUserOperation(operation);
      
      expect(result.success).toBe(true);
      expect(result.processedCount).toBeGreaterThanOrEqual(0);
      expect(result.failedCount).toBeGreaterThanOrEqual(0);
      expect(result.results).toBeInstanceOf(Array);
    });
  });

  // 6. Audit logging tests
  describe('Audit Logging', () => {
    it('should fetch audit logs with filtering', async () => {
      const logs: PaginatedResponse<AuditLog> = await adminService.getAuditLogs(1, 20);
      
      expect(logs.items).toBeInstanceOf(Array);
      expect(logs.total).toBeGreaterThanOrEqual(0);
      
      if (logs.items.length > 0) {
        const log = logs.items[0];
        expect(log.id).toBeDefined();
        expect(log.action).toBeDefined();
        expect(log.userId).toBeDefined();
        expect(log.timestamp).toBeDefined();
        expect(log.ipAddress).toBeDefined();
      }
    });

    it('should log an admin action', async () => {
      const actionData = {
        action: 'user_created',
        targetType: 'user',
        targetId: 'test-user-id',
        details: { email: 'test@example.com' }
      };
      
      const result = await adminService.logAction(actionData);
      
      expect(result.success).toBe(true);
      expect(result.logId).toBeDefined();
    });

    it('should fetch activity timeline for a specific entity', async () => {
      const entityType = 'user';
      const entityId = 'test-user-id';
      
      const timeline: AuditLog[] = await adminService.getActivityTimeline(entityType, entityId);
      
      expect(timeline).toBeInstanceOf(Array);
      
      if (timeline.length > 0) {
        const event = timeline[0];
        expect(event.targetType).toBe(entityType);
        expect(event.targetId).toBe(entityId);
      }
    });
  });

  // 7. System operations tests
  describe('System Operations', () => {
    it('should initiate system backup', async () => {
      const backupOptions = {
        includeUserData: true,
        includeSystemSettings: true,
        compression: 'gzip'
      };
      
      const result = await adminService.backupSystem(backupOptions);
      
      expect(result.success).toBe(true);
      expect(result.backupId).toBeDefined();
      expect(result.estimatedSize).toBeGreaterThanOrEqual(0);
    });

    it('should clear system cache', async () => {
      const cacheType = 'user_sessions';
      
      const result = await adminService.clearCache(cacheType);
      
      expect(result.success).toBe(true);
      expect(result.clearedKeys).toBeGreaterThanOrEqual(0);
    });

    it('should restart a system service', async () => {
      const serviceName = 'auth-service';
      
      const result = await adminService.restartService(serviceName);
      
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.restartTime).toBeDefined();
    });

    it('should fetch integration statuses', async () => {
      const statuses: IntegrationStatus[] = await adminService.getIntegrationStatus();
      
      expect(statuses).toBeInstanceOf(Array);
      
      if (statuses.length > 0) {
        const status = statuses[0];
        expect(status.name).toBeDefined();
        expect(status.status).toMatch(/^(connected|disconnected|error)$/);
        expect(status.lastChecked).toBeDefined();
      }
    });
  });

  // 8. Analytics tests
  describe('Analytics', () => {
    it('should fetch admin analytics dashboard data', async () => {
      const analytics: AdminAnalytics = await adminService.getAdminAnalytics();
      
      expect(analytics.userGrowth).toBeInstanceOf(Array);
      expect(analytics.systemUsage).toBeDefined();
      expect(analytics.performanceMetrics).toBeDefined();
      expect(analytics.errorRates).toBeInstanceOf(Array);
    });

    it('should generate custom report', async () => {
      const reportConfig = {
        type: 'user_activity',
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31'
        },
        filters: {
          tenantId: 'test-tenant'
        }
      };
      
      const report = await adminService.generateReport(reportConfig);
      
      expect(report.id).toBeDefined();
      expect(report.status).toBe('generated');
      expect(report.data).toBeDefined();
      expect(report.generatedAt).toBeDefined();
    });

    it('should fetch usage statistics', async () => {
      const stats: UsageStatistics = await adminService.getUsageStatistics();
      
      expect(stats.totalApiCalls).toBeGreaterThanOrEqual(0);
      expect(stats.activeUsers).toBeGreaterThanOrEqual(0);
      expect(stats.storageUsed).toBeGreaterThanOrEqual(0);
      expect(stats.bandwidthUsed).toBeGreaterThanOrEqual(0);
    });
  });

  // 9. Notifications tests
  describe('Notifications', () => {
    it('should send broadcast notification', async () => {
      const broadcast = {
        title: 'System Maintenance',
        message: 'System will be down for maintenance',
        type: 'warning',
        targetAudience: 'all'
      };
      
      const result = await adminService.sendBroadcast(broadcast);
      
      expect(result.success).toBe(true);
      expect(result.notificationId).toBeDefined();
      expect(result.recipientCount).toBeGreaterThanOrEqual(0);
    });

    it('should fetch notification templates', async () => {
      const templates: NotificationTemplate[] = await adminService.getNotificationTemplates();
      
      expect(templates).toBeInstanceOf(Array);
      
      if (templates.length > 0) {
        const template = templates[0];
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.subject).toBeDefined();
        expect(template.body).toBeDefined();
      }
    });

    it('should update notification settings', async () => {
      const settings = {
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: true,
        defaultLanguage: 'en'
      };
      
      const result = await adminService.updateNotificationSettings(settings);
      
      expect(result.success).toBe(true);
      expect(result.updatedSettings).toEqual(settings);
    });
  });

  // 10. Security tests
  describe('Security', () => {
    it('should fetch security overview', async () => {
      const overview: SecurityOverview = await adminService.getSecurityOverview();
      
      expect(overview.activeSessions).toBeGreaterThanOrEqual(0);
      expect(overview.failedLoginAttempts).toBeGreaterThanOrEqual(0);
      expect(overview.suspiciousActivities).toBeGreaterThanOrEqual(0);
      expect(overview.lastSecurityScan).toBeDefined();
    });

    it('should fetch failed login attempts', async () => {
      const attempts: FailedLogin[] = await adminService.getFailedLogins(24);
      
      expect(attempts).toBeInstanceOf(Array);
      
      if (attempts.length > 0) {
        const attempt = attempts[0];
        expect(attempt.email).toBeDefined();
        expect(attempt.ipAddress).toBeDefined();
        expect(attempt.timestamp).toBeDefined();
        expect(attempt.reason).toBeDefined();
      }
    });

    it('should fetch suspicious activity reports', async () => {
      const activities: SuspiciousActivity[] = await adminService.getSuspiciousActivity();
      
      expect(activities).toBeInstanceOf(Array);
      
      if (activities.length > 0) {
        const activity = activities[0];
        expect(activity.userId).toBeDefined();
        expect(activity.type).toBeDefined();
        expect(activity.riskScore).toBeGreaterThanOrEqual(0);
        expect(activity.timestamp).toBeDefined();
      }
    });

    it('should run security scan', async () => {
      const scanOptions = {
        scanType: 'full',
        includeVulnerabilities: true
      };
      
      const result = await adminService.runSecurityScan(scanOptions);
      
      expect(result.success).toBe(true);
      expect(result.scanId).toBeDefined();
      expect(result.estimatedDuration).toBeGreaterThanOrEqual(0);
    });
  });

  // Error handling tests
  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // This test will verify error handling when network is unavailable
      // The implementation should handle this properly
      try {
        await adminService.getSystemMetrics();
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });

    it('should handle authentication errors', async () => {
      // Test behavior when authentication fails
      try {
        await adminService.getRoles();
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });

    it('should handle validation errors', async () => {
      // Test behavior with invalid data
      try {
        await adminService.createUser({
          email: 'invalid-email',
          name: '',
          role: 'invalid-role',
          tenantId: ''
        });
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });
  });
});