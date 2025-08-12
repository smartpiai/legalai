/**
 * Test setup file for Vitest
 * Configures testing environment for React components
 */
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock window.matchMedia (for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver (for lazy loading)
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver (for responsive layouts)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock scrollTo (for navigation)
window.scrollTo = vi.fn()

// Mock alert (for user notifications)
window.alert = vi.fn()

// Mock URL constructor and URL methods (for axios and file downloads)
class MockURL {
  href: string;
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  
  constructor(url: string, base?: string) {
    // Simple URL parsing for tests
    this.href = url;
    this.protocol = 'http:';
    this.hostname = 'localhost';
    this.port = '8000';
    this.pathname = '/api/v1';
    this.search = '';
    this.hash = '';
  }

  static createObjectURL = vi.fn(() => 'mocked-object-url');
  static revokeObjectURL = vi.fn();
}

// Set global URL constructor
Object.defineProperty(global, 'URL', {
  value: MockURL,
  writable: true,
});

Object.defineProperty(window, 'URL', {
  value: MockURL,
});

// Mock location for test environment detection
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000/test',
    origin: 'http://localhost:3000',
    pathname: '/test',
  },
  writable: true,
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
})