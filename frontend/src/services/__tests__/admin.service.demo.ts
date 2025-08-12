/**
 * Admin Service Demo
 * Shows how to use the AdminService when backend is available
 */

import { AdminService } from '../admin.service';

// Example usage of the AdminService
export async function demoAdminService() {
  const adminService = new AdminService();

  try {
    // 1. Dashboard metrics
    console.log('Fetching system metrics...');
    const metrics = await adminService.getSystemMetrics();
    console.log('System Health:', metrics.systemHealth);
    console.log('Total Users:', metrics.totalUsers);

    // 2. User management with pagination
    console.log('\nFetching users...');
    const users = await adminService.getUsers(1, 10);
    console.log('Total Users Found:', users.total);
    console.log('Users on Page 1:', users.items.length);

    // 3. Role management
    console.log('\nFetching roles...');
    const roles = await adminService.getRoles();
    console.log('Available Roles:', roles.map(r => r.name));

    // 4. Creating a new user
    console.log('\nCreating new user...');
    const newUser = await adminService.createUser({
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'user',
      tenantId: 'demo-tenant'
    });
    console.log('Created User ID:', newUser.id);

    // 5. Security overview
    console.log('\nGetting security overview...');
    const security = await adminService.getSecurityOverview();
    console.log('Active Sessions:', security.activeSessions);
    console.log('Security Score:', security.securityScore);

    // 6. System operations
    console.log('\nClearing cache...');
    const cacheResult = await adminService.clearCache('user_sessions');
    console.log('Cache cleared:', cacheResult.success);

    // 7. Analytics
    console.log('\nFetching analytics...');
    const analytics = await adminService.getAdminAnalytics();
    console.log('Performance Metrics:', analytics.performanceMetrics);

    return 'Demo completed successfully!';

  } catch (error) {
    console.error('Demo failed:', error);
    throw error;
  }
}

// TypeScript usage examples
export function typeScriptExamples() {
  const adminService = new AdminService();

  // Type-safe system metrics access
  adminService.getSystemMetrics().then(metrics => {
    // TypeScript knows these properties exist and their types
    const cpuUsage: number = metrics.cpuUsage;
    const health: 'healthy' | 'warning' | 'critical' = metrics.systemHealth;
    const uptime: number = metrics.uptime;
  });

  // Type-safe user creation
  const userData = {
    email: 'user@example.com',
    name: 'Test User',
    role: 'admin',
    tenantId: 'tenant-123'
  };
  // TypeScript ensures all required fields are present
  adminService.createUser(userData);

  // Type-safe pagination
  adminService.getUsers(1, 20).then(result => {
    // TypeScript knows the structure of paginated response
    const items: any[] = result.items;
    const total: number = result.total;
    const hasNext: boolean = result.hasNext;
  });

  // Type-safe role management
  const roleData = {
    name: 'Custom Role',
    description: 'A custom role with specific permissions',
    permissions: ['contracts.read', 'contracts.write']
  };
  adminService.createRole(roleData);
}

// Caching demonstration
export async function cachingDemo() {
  const adminService = new AdminService();

  try {
    console.log('First call - will hit API...');
    const start1 = Date.now();
    await adminService.getSystemMetrics();
    console.log('First call took:', Date.now() - start1, 'ms');

    console.log('Second call - will use cache...');
    const start2 = Date.now();
    await adminService.getSystemMetrics();
    console.log('Second call took:', Date.now() - start2, 'ms');

    // Clear cache and try again
    (adminService as any).clearCache('system-metrics');
    console.log('Third call after cache clear - will hit API...');
    const start3 = Date.now();
    await adminService.getSystemMetrics();
    console.log('Third call took:', Date.now() - start3, 'ms');

  } catch (error) {
    console.log('Cache demo completed (expected network errors in test environment)');
  }
}

// Error handling demonstration  
export async function errorHandlingDemo() {
  const adminService = new AdminService();

  try {
    // This will fail gracefully with proper error context
    await adminService.getSystemMetrics();
  } catch (error) {
    console.log('Error caught:', error.message);
    console.log('Error includes context: "Failed to fetch system metrics"');
  }

  try {
    // Invalid user data will be caught
    await adminService.createUser({
      email: 'invalid-email',
      name: '',
      role: 'nonexistent-role' as any,
      tenantId: ''
    });
  } catch (error) {
    console.log('Validation error caught:', error.message);
  }
}