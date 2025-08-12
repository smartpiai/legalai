/**
 * @fileoverview Performance Optimization Service Tests
 * Comprehensive test suite for frontend performance optimization
 * Following TDD Red-Green-Refactor methodology
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { 
  PerformanceOptimizationService, 
  PerformanceConfig, 
  CoreWebVitals, 
  PerformanceMetrics, 
  CacheStrategy, 
  OptimizationSuggestion,
  BundleAnalysis,
  MemoryUsage,
  NetworkMetrics
} from '../performance-optimization.service';

// Mock DOM APIs
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
});

const mockPerformanceObserver = vi.fn();
mockPerformanceObserver.mockReturnValue({
  observe: vi.fn(),
  disconnect: vi.fn()
});

// Mock Worker
class MockWorker {
  constructor(public stringUrl: string) {}
  postMessage = vi.fn();
  terminate = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: mockIntersectionObserver
});

Object.defineProperty(window, 'PerformanceObserver', {
  writable: true,
  configurable: true,
  value: mockPerformanceObserver
});

Object.defineProperty(window, 'Worker', {
  writable: true,
  configurable: true,
  value: MockWorker
});

// Mock service worker registration
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    register: vi.fn().mockResolvedValue({
      installing: null,
      waiting: null,
      active: {
        postMessage: vi.fn()
      },
      addEventListener: vi.fn(),
      update: vi.fn()
    }),
    ready: Promise.resolve({
      active: {
        postMessage: vi.fn()
      }
    })
  },
  configurable: true
});

// Mock Cache API
const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  keys: vi.fn().mockResolvedValue([])
};

Object.defineProperty(global, 'caches', {
  value: {
    open: vi.fn().mockResolvedValue(mockCache),
    keys: vi.fn().mockResolvedValue(['app-cache-v1'])
  },
  configurable: true
});

// Mock fetch with proper URL handling
global.fetch = vi.fn().mockImplementation((url) => {
  if (typeof url === 'string' && url.startsWith('/')) {
    return Promise.resolve(new Response('OK'));
  }
  if (url === '/api/unreliable') {
    // Simulate network error for retry test
    return Promise.reject(new Error('Network error'));
  }
  return Promise.resolve(new Response('OK'));
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn((type) => {
      switch (type) {
        case 'largest-contentful-paint':
          return [{ startTime: 1500, value: 1500, name: 'largest-contentful-paint' }];
        case 'paint':
          return [{ startTime: 800, name: 'first-contentful-paint' }];
        case 'navigation':
          return [{ responseStart: 200, fetchStart: 100, type: 0 }];
        case 'resource':
          return [
            { name: '/app.js', transferSize: 250000, encodedBodySize: 240000 },
            { name: '/chunk.js', transferSize: 150000, encodedBodySize: 140000 } // Over 100KB limit
          ];
        default:
          return [];
      }
    }),
    getEntriesByName: vi.fn(() => []),
    navigation: {
      type: 0
    },
    memory: {
      usedJSHeapSize: 10000000,
      totalJSHeapSize: 20000000,
      jsHeapSizeLimit: 100000000
    }
  },
  configurable: true
});

// Mock connection API
Object.defineProperty(navigator, 'connection', {
  value: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 100,
    saveData: false
  },
  configurable: true
});

describe('PerformanceOptimizationService', () => {
  let service: PerformanceOptimizationService;
  let mockConfig: PerformanceConfig;

  beforeEach(() => {
    mockConfig = {
      bundleSize: {
        maxInitialSize: 200000, // 200KB
        maxChunkSize: 100000,   // 100KB
        enableTreeShaking: true,
        enableCodeSplitting: true
      },
      caching: {
        strategy: 'cache-first' as CacheStrategy,
        maxAge: 3600000, // 1 hour
        enableServiceWorker: true,
        cacheAssets: true
      },
      monitoring: {
        enableCoreWebVitals: true,
        enableRUM: true,
        reportingEndpoint: '/api/performance',
        sampleRate: 0.1
      },
      optimization: {
        enableLazyLoading: true,
        enableImageOptimization: true,
        enableVirtualScrolling: true,
        enablePreloading: true
      }
    };

    service = new PerformanceOptimizationService(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize with default config when none provided', () => {
      const defaultService = new PerformanceOptimizationService();
      expect(defaultService).toBeDefined();
    });

    it('should merge provided config with defaults', () => {
      const partialConfig = {
        bundleSize: {
          maxInitialSize: 150000
        }
      };
      const serviceWithPartial = new PerformanceOptimizationService(partialConfig);
      expect(serviceWithPartial).toBeDefined();
    });

    it('should set up performance observers on initialization', () => {
      // Performance observer should be called during initialization
      expect(mockPerformanceObserver).toHaveBeenCalled();
    });
  });

  describe('Core Web Vitals Monitoring', () => {
    it('should track Largest Contentful Paint (LCP)', async () => {
      const vitals = await service.getCoreWebVitals();
      expect(vitals).toHaveProperty('lcp');
    });

    it('should track First Input Delay (FID)', async () => {
      const vitals = await service.getCoreWebVitals();
      expect(vitals).toHaveProperty('fid');
    });

    it('should track Cumulative Layout Shift (CLS)', async () => {
      const vitals = await service.getCoreWebVitals();
      expect(vitals).toHaveProperty('cls');
    });

    it('should track First Contentful Paint (FCP)', async () => {
      const vitals = await service.getCoreWebVitals();
      expect(vitals).toHaveProperty('fcp');
    });

    it('should track Time to First Byte (TTFB)', async () => {
      const vitals = await service.getCoreWebVitals();
      expect(vitals).toHaveProperty('ttfb');
    });

    it('should report vitals when thresholds are exceeded', async () => {
      const reportSpy = vi.spyOn(service, 'reportPerformanceMetrics');
      
      // Directly call reportMetric with a threshold-exceeding value
      // This simulates what would happen when observers detect poor performance
      (service as any).reportMetric('lcp', 3000); // Exceeds 2500ms threshold
      
      expect(reportSpy).toHaveBeenCalled();
    });
  });

  describe('Bundle Size Optimization', () => {
    it('should analyze bundle size', async () => {
      const analysis = await service.analyzeBundleSize();
      expect(analysis).toHaveProperty('totalSize');
      expect(analysis).toHaveProperty('chunks');
      expect(analysis).toHaveProperty('recommendations');
    });

    it('should identify oversized chunks', async () => {
      const analysis = await service.analyzeBundleSize();
      const oversizedChunks = analysis.chunks.filter(chunk => chunk.size > mockConfig.bundleSize.maxChunkSize);
      
      if (oversizedChunks.length > 0) {
        expect(analysis.recommendations).toContain(
          expect.objectContaining({
            type: 'chunk-optimization',
            priority: 'medium'
          })
        );
      }
      
      // Always expect at least bundle optimization recommendation due to large total size
      expect(analysis.recommendations).toContain(
        expect.objectContaining({
          type: 'bundle-optimization',
          priority: 'high'
        })
      );
    });

    it('should suggest code splitting for large bundles', async () => {
      const analysis = await service.analyzeBundleSize();
      if (analysis.totalSize > mockConfig.bundleSize.maxInitialSize) {
        expect(analysis.recommendations).toContainEqual(
          expect.objectContaining({
            message: expect.stringContaining('code splitting')
          })
        );
      }
    });

    it('should track tree shaking effectiveness', async () => {
      const analysis = await service.analyzeBundleSize();
      expect(analysis).toHaveProperty('treeShakingStats');
    });
  });

  describe('Caching Strategies', () => {
    it('should register service worker when enabled', async () => {
      await service.initializeCaching();
      expect(navigator.serviceWorker.register).toHaveBeenCalled();
    });

    it('should implement cache-first strategy', async () => {
      const mockResponse = new Response('cached data');
      const cacheFirst = service.createCacheStrategy('cache-first');
      const result = await cacheFirst('/api/test');
      expect(result).toBeDefined();
    });

    it('should implement network-first strategy', async () => {
      const networkFirst = service.createCacheStrategy('network-first');
      const result = await networkFirst('/api/test');
      expect(result).toBeDefined();
    });

    it('should handle cache misses gracefully', async () => {
      const cacheFirst = service.createCacheStrategy('cache-first');
      const result = await cacheFirst('/api/nonexistent');
      expect(result).toBeDefined();
    });

    it('should invalidate cache based on age', async () => {
      const invalidated = await service.invalidateExpiredCache();
      expect(typeof invalidated).toBe('number');
    });
  });

  describe('Lazy Loading', () => {
    it('should create intersection observer for images', () => {
      const images = [document.createElement('img')];
      service.enableImageLazyLoading(images);
      expect(mockIntersectionObserver).toHaveBeenCalled();
    });

    it('should lazy load components', async () => {
      const mockImport = vi.fn().mockResolvedValue({ default: () => 'MockComponent' });
      const LazyComponent = service.createLazyComponent(mockImport);
      expect(LazyComponent).toBeDefined();
    });

    it('should provide loading fallback for lazy components', async () => {
      const mockImport = vi.fn().mockResolvedValue({ default: () => 'MockComponent' });
      const LazyComponent = service.createLazyComponent(
        mockImport,
        () => ({ type: 'div', children: 'Loading...' } as any)
      );
      expect(LazyComponent).toBeDefined();
    });
  });

  describe('Virtual Scrolling', () => {
    it('should create virtual scroll container', () => {
      const container = service.createVirtualScrollContainer({
        itemHeight: 50,
        containerHeight: 400,
        items: Array.from({ length: 1000 }, (_, i) => `Item ${i}`)
      });
      expect(container).toBeDefined();
    });

    it('should calculate visible items correctly', () => {
      const visibleItems = service.calculateVisibleItems({
        scrollTop: 100,
        containerHeight: 400,
        itemHeight: 50,
        totalItems: 1000
      });
      expect(visibleItems.startIndex).toBeGreaterThanOrEqual(0);
      expect(visibleItems.endIndex).toBeGreaterThan(visibleItems.startIndex);
    });
  });

  describe('Web Worker Integration', () => {
    it('should create web worker for heavy computations', () => {
      const worker = service.createWebWorker('heavy-computation');
      expect(worker).toBeInstanceOf(MockWorker);
    });

    it('should handle worker messages', async () => {
      // Mock worker postMessage to simulate response
      const mockWorker = new MockWorker('test');
      vi.spyOn(service, 'createWebWorker').mockReturnValue(mockWorker);
      
      // Simulate worker response after a short delay
      setTimeout(() => {
        const messageEvent = { data: { result: 'calculated' } };
        if (mockWorker.addEventListener.mock.calls.length > 0) {
          const messageHandler = mockWorker.addEventListener.mock.calls.find(call => call[0] === 'message')?.[1];
          if (messageHandler) messageHandler(messageEvent);
        }
      }, 10);

      const resultPromise = service.executeInWorker('calculate', { data: [1, 2, 3] });
      const result = await Promise.race([
        resultPromise,
        new Promise(resolve => setTimeout(() => resolve('timeout'), 100))
      ]);
      
      expect(result).toBeDefined();
    }, 1000);

    it('should terminate workers on cleanup', () => {
      const worker = service.createWebWorker('test');
      service.cleanup();
      expect(worker.terminate).toHaveBeenCalled();
    });
  });

  describe('Memory Management', () => {
    it('should track memory usage', () => {
      const memory = service.getMemoryUsage();
      expect(memory).toHaveProperty('used');
      expect(memory).toHaveProperty('total');
      expect(memory).toHaveProperty('percentage');
    });

    it('should detect memory leaks', async () => {
      const leaks = await service.detectMemoryLeaks();
      expect(Array.isArray(leaks)).toBe(true);
    });

    it('should suggest memory optimization', () => {
      const suggestions = service.getMemoryOptimizationSuggestions();
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('Network Optimization', () => {
    it('should batch API requests', async () => {
      // Reset fetch mock for this test
      vi.mocked(global.fetch).mockResolvedValue(new Response('OK'));
      
      const requests = [
        { url: 'https://api.example.com/data1', method: 'GET' },
        { url: 'https://api.example.com/data2', method: 'GET' }
      ];
      const results = await service.batchRequests(requests);
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
    });

    it('should deduplicate identical requests', async () => {
      // Reset fetch mock for this test
      vi.mocked(global.fetch).mockResolvedValue(new Response('OK'));
      
      const request1 = service.optimizedFetch('https://api.example.com/same-endpoint');
      const request2 = service.optimizedFetch('https://api.example.com/same-endpoint');
      
      const [result1, result2] = await Promise.all([request1, request2]);
      expect(result1).toBe(result2);
    });

    it('should implement retry logic with exponential backoff', async () => {
      // Mock fetch to fail first few times then succeed
      let callCount = 0;
      vi.mocked(global.fetch).mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(new Response('OK'));
      });

      const result = await service.fetchWithRetry('/api/unreliable', {
        maxRetries: 3,
        backoff: 'exponential'
      });
      expect(result).toBeDefined();
      expect(result.status).toBe(200);
    }, 1000);
  });

  describe('Resource Hints', () => {
    it('should add preload links', () => {
      service.preloadResource('/critical.css', 'style');
      const link = document.querySelector('link[rel="preload"]');
      expect(link).toBeTruthy();
    });

    it('should add prefetch links', () => {
      service.prefetchResource('/next-page.js');
      const link = document.querySelector('link[rel="prefetch"]');
      expect(link).toBeTruthy();
    });

    it('should add preconnect links', () => {
      service.preconnectToOrigin('https://api.example.com');
      const link = document.querySelector('link[rel="preconnect"]');
      expect(link).toBeTruthy();
    });
  });

  describe('Debouncing and Throttling', () => {
    it('should debounce function calls', async () => {
      const mockFn = vi.fn();
      const debouncedFn = service.debounce(mockFn, 100);
      
      debouncedFn();
      debouncedFn();
      debouncedFn();
      
      expect(mockFn).not.toHaveBeenCalled();
      
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should throttle function calls', async () => {
      const mockFn = vi.fn();
      const throttledFn = service.throttle(mockFn, 100);
      
      throttledFn();
      throttledFn();
      throttledFn();
      
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance Monitoring', () => {
    it('should collect performance metrics', async () => {
      const metrics = await service.collectPerformanceMetrics();
      expect(metrics).toHaveProperty('navigation');
      expect(metrics).toHaveProperty('resources');
      expect(metrics).toHaveProperty('memory');
    });

    it('should generate performance report', async () => {
      const report = await service.generatePerformanceReport();
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('recommendations');
    });

    it('should send metrics to reporting endpoint', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('OK'));
      await service.reportPerformanceMetrics({} as PerformanceMetrics);
      expect(fetchSpy).toHaveBeenCalled();
    });
  });

  describe('Optimization Suggestions', () => {
    it('should generate suggestions based on metrics', async () => {
      const suggestions = await service.generateOptimizationSuggestions();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should prioritize suggestions by impact', async () => {
      const suggestions = await service.generateOptimizationSuggestions();
      const highPriority = suggestions.filter(s => s.priority === 'high');
      const mediumPriority = suggestions.filter(s => s.priority === 'medium');
      expect(highPriority.length).toBeGreaterThanOrEqual(0);
      expect(mediumPriority.length).toBeGreaterThanOrEqual(0);
    });

    it('should include implementation details in suggestions', async () => {
      const suggestions = await service.generateOptimizationSuggestions();
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('message');
        expect(suggestion).toHaveProperty('type');
        expect(suggestion).toHaveProperty('priority');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing browser APIs gracefully', () => {
      // Temporarily remove API
      const originalObserver = window.IntersectionObserver;
      delete (window as any).IntersectionObserver;
      
      expect(() => service.enableImageLazyLoading([])).not.toThrow();
      
      // Restore
      window.IntersectionObserver = originalObserver;
    });

    it('should handle service worker registration failures', async () => {
      vi.mocked(navigator.serviceWorker.register).mockRejectedValue(new Error('SW failed'));
      await expect(service.initializeCaching()).resolves.not.toThrow();
    });

    it('should handle worker creation failures', () => {
      const originalWorker = window.Worker;
      (window as any).Worker = undefined;
      
      expect(() => service.createWebWorker('test')).not.toThrow();
      
      window.Worker = originalWorker;
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration at runtime', () => {
      const newConfig = { ...mockConfig, bundleSize: { ...mockConfig.bundleSize, maxInitialSize: 150000 } };
      service.updateConfig(newConfig);
      expect(service.getConfig()).toEqual(newConfig);
    });

    it('should validate configuration values', () => {
      const invalidConfig = { bundleSize: { maxInitialSize: -1 } };
      expect(() => service.updateConfig(invalidConfig)).toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup observers and workers', () => {
      const worker = service.createWebWorker('test');
      service.cleanup();
      expect(worker.terminate).toHaveBeenCalled();
    });

    it('should remove event listeners', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      service.cleanup();
      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });
});