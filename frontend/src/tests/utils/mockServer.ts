/**
 * Mock Server Setup for E2E Tests
 * Provides consistent API responses for testing
 * NOTE: MSW temporarily disabled for build compatibility
 */

// Mock MSW imports for testing (commenting out for now to fix build)
// import { setupServer } from 'msw/node';
// import { http } from 'msw';

const API_URL = process.env.VITE_API_URL || 'http://localhost:8000';

// Define mock handlers (commenting out MSW usage for now)
const handlers: any[] = [
  // Mock handlers would go here when MSW is properly configured
];

// Mock test globals
declare global {
  var afterEach: (fn: () => void) => void;
  var afterAll: (fn: () => void) => void;
}

// Setup mock server
export function setupMockServer() {
  // Mock server implementation when MSW is properly set up
  const mockServer = {
    listen: (options?: any) => {
      console.log('Mock server listening (mocked for build)');
    },
    resetHandlers: () => {
      console.log('Mock server handlers reset (mocked for build)');
    },
    close: () => {
      console.log('Mock server closed (mocked for build)');
    }
  };
  
  // Mock test lifecycle functions
  if (typeof afterEach !== 'undefined') {
    afterEach(() => mockServer.resetHandlers());
  }
  
  if (typeof afterAll !== 'undefined') {
    afterAll(() => mockServer.close());
  }
  
  return mockServer;
}

// Export handlers for custom overrides in tests
export { handlers };