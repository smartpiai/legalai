/**
 * Mock Server Setup for E2E Tests
 * Provides consistent API responses for testing
 */

import { setupServer } from 'msw/node';
import { rest } from 'msw';

const API_URL = process.env.VITE_API_URL || 'http://localhost:8000';

// Define mock handlers
const handlers = [
  // Authentication
  rest.post(`${API_URL}/api/v1/auth/login`, (req, res, ctx) => {
    const { email, password } = req.body as any;
    
    if (password === 'TestPassword123!') {
      return res(
        ctx.status(200),
        ctx.json({
          access_token: 'mock-jwt-token',
          token_type: 'bearer',
          user: {
            id: 'user-123',
            email,
            name: 'Test User',
            role: 'contract_manager',
            tenant_id: email.includes('tenanta') ? 'tenant-a' : 'tenant-b',
            permissions: ['contracts.create', 'contracts.upload', 'contracts.read']
          }
        })
      );
    }
    
    return res(
      ctx.status(401),
      ctx.json({ detail: 'Invalid credentials' })
    );
  }),

  // Contract upload
  rest.post(`${API_URL}/api/v1/contracts/upload`, async (req, res, ctx) => {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return res(
      ctx.status(201),
      ctx.json({
        id: 'contract-' + Date.now(),
        title: 'Uploaded Contract',
        status: 'processing',
        upload_status: 'completed',
        file_path: '/contracts/uploaded-file.pdf'
      })
    );
  }),

  // Contract creation
  rest.post(`${API_URL}/api/v1/contracts`, (req, res, ctx) => {
    const body = req.body as any;
    
    return res(
      ctx.status(201),
      ctx.json({
        id: 'contract-' + Date.now(),
        ...body,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    );
  }),

  // Contract retrieval
  rest.get(`${API_URL}/api/v1/contracts/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return res(
        ctx.status(401),
        ctx.json({ detail: 'Not authenticated' })
      );
    }
    
    // Check tenant isolation
    const tenantId = req.headers.get('X-Tenant-ID');
    if (id.includes('tenant-a') && tenantId === 'tenant-b') {
      return res(
        ctx.status(403),
        ctx.json({ detail: 'Access denied' })
      );
    }
    
    return res(
      ctx.status(200),
      ctx.json({
        id,
        title: 'Test Contract',
        status: 'active',
        parties: ['Party A', 'Party B'],
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        value: 100000
      })
    );
  }),

  // Metadata extraction
  rest.post(`${API_URL}/api/v1/extraction/extract`, async (req, res, ctx) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return res(
      ctx.status(200),
      ctx.json({
        entities: {
          parties: ['Acme Corp', 'Legal AI Inc'],
          dates: {
            start_date: '2024-01-01',
            end_date: '2024-12-31'
          },
          value: 100000,
          clauses: ['Confidentiality', 'Termination', 'Payment Terms']
        },
        confidence: 0.95
      })
    );
  }),

  // Analytics tracking
  rest.post(`${API_URL}/api/v1/analytics/track`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ success: true }));
  }),

  // Dashboard data
  rest.get(`${API_URL}/api/v1/dashboard/executive-summary`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        total_contracts: 150,
        active_contracts: 120,
        expiring_soon: 15,
        total_value: 5000000,
        compliance_rate: 0.95,
        risk_score: 0.25,
        recent_activities: 45
      })
    );
  }),

  // Notifications
  rest.get(`${API_URL}/api/v1/notifications`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: 'notif-1',
          title: 'Contract Review Required',
          message: 'Contract needs your review',
          type: 'warning',
          read: false,
          timestamp: new Date().toISOString()
        }
      ])
    );
  })
];

// Setup mock server
export function setupMockServer() {
  const server = setupServer(...handlers);
  
  // Start server
  server.listen({ onUnhandledRequest: 'bypass' });
  
  // Reset handlers after each test
  afterEach(() => server.resetHandlers());
  
  // Clean up after all tests
  afterAll(() => server.close());
  
  return server;
}

// Export handlers for custom overrides in tests
export { handlers };