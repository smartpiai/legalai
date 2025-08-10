/**
 * Performance benchmark tests
 * Following TDD - RED phase: Writing comprehensive performance tests
 */

import {
  measureRenderTime,
  measureApiLatency,
  measureBundleLoadTime,
  measureMemoryUsage,
  measureFPS,
  measureTTFB,
  measureFCP,
  measureLCP,
  measureCLS,
  measureINP,
  generatePerformanceReport,
  trackUserTiming,
  analyzeRenderPerformance,
  detectMemoryLeaks,
  profileComponent,
  benchmarkFunction,
  comparePerformance,
  setPerformanceThresholds,
  checkPerformanceThresholds,
  getPerformanceMetrics,
  clearPerformanceData,
  exportPerformanceData,
  schedulePerformanceCheck,
  measureNetworkSpeed,
  detectSlowComponents,
  optimizationSuggestions
} from '../performanceBenchmark';

// Mock Performance Observer API
const mockPerformanceObserver = jest.fn();
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();

(global as any).PerformanceObserver = jest.fn().mockImplementation((callback) => {
  mockPerformanceObserver(callback);
  return {
    observe: mockObserve,
    disconnect: mockDisconnect
  };
});

// Mock performance.now()
const mockPerformanceNow = jest.spyOn(performance, 'now');

// Mock performance.mark() and performance.measure()
const mockMark = jest.spyOn(performance, 'mark');
const mockMeasure = jest.spyOn(performance, 'measure');
const mockGetEntriesByType = jest.spyOn(performance, 'getEntriesByType');
const mockGetEntriesByName = jest.spyOn(performance, 'getEntriesByName');

// Mock memory API
Object.defineProperty(performance, 'memory', {
  value: {
    usedJSHeapSize: 10000000,
    totalJSHeapSize: 20000000,
    jsHeapSizeLimit: 30000000
  },
  writable: true
});

// Mock fetch for API latency tests
global.fetch = jest.fn();

describe('Performance Benchmark Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearPerformanceData();
    mockPerformanceNow.mockReturnValue(1000);
  });

  describe('Component Render Performance', () => {
    it('should measure component render time', async () => {
      mockPerformanceNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1050);

      const renderTime = await measureRenderTime('ContractList');
      
      expect(renderTime).toEqual({
        component: 'ContractList',
        duration: 50,
        timestamp: expect.any(Number)
      });
      expect(mockMark).toHaveBeenCalledWith('ContractList-render-start');
      expect(mockMark).toHaveBeenCalledWith('ContractList-render-end');
    });

    it('should profile component with multiple renders', async () => {
      const profile = await profileComponent('ContractEditor', {
        iterations: 10,
        warmup: 2
      });

      expect(profile).toEqual({
        component: 'ContractEditor',
        iterations: 10,
        average: expect.any(Number),
        median: expect.any(Number),
        min: expect.any(Number),
        max: expect.any(Number),
        standardDeviation: expect.any(Number),
        percentiles: {
          p50: expect.any(Number),
          p75: expect.any(Number),
          p90: expect.any(Number),
          p95: expect.any(Number),
          p99: expect.any(Number)
        }
      });
    });

    it('should detect slow rendering components', async () => {
      const slowComponents = await detectSlowComponents({
        threshold: 16 // 60fps = 16ms per frame
      });

      expect(slowComponents).toEqual(
        expect.arrayContaining([
          {
            component: expect.any(String),
            averageRenderTime: expect.any(Number),
            exceedsThreshold: expect.any(Boolean),
            suggestion: expect.any(String)
          }
        ])
      );
    });

    it('should analyze render performance patterns', () => {
      const analysis = analyzeRenderPerformance({
        timeRange: '1h',
        groupBy: 'component'
      });

      expect(analysis).toEqual({
        totalRenders: expect.any(Number),
        averageRenderTime: expect.any(Number),
        slowestComponents: expect.any(Array),
        renderFrequency: expect.any(Object),
        trends: expect.any(Object)
      });
    });
  });

  describe('API Latency Measurement', () => {
    it('should measure API endpoint latency', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      mockPerformanceNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1150);

      const latency = await measureApiLatency('/api/v1/contracts');

      expect(latency).toEqual({
        endpoint: '/api/v1/contracts',
        method: 'GET',
        duration: 150,
        status: 200,
        timestamp: expect.any(Number)
      });
    });

    it('should measure API latency with different methods', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201
      });

      const latency = await measureApiLatency('/api/v1/contracts', {
        method: 'POST',
        body: JSON.stringify({ data: 'test' })
      });

      expect(latency.method).toBe('POST');
      expect(latency.status).toBe(201);
    });

    it('should track API latency trends', async () => {
      // Simulate multiple API calls
      for (let i = 0; i < 10; i++) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200
        });
        await measureApiLatency('/api/v1/contracts');
      }

      const metrics = getPerformanceMetrics('api');
      expect(metrics.apiLatency).toHaveProperty('/api/v1/contracts');
      expect(metrics.apiLatency['/api/v1/contracts'].count).toBe(10);
    });
  });

  describe('Bundle Load Performance', () => {
    it('should measure bundle load time', async () => {
      mockGetEntriesByType.mockReturnValueOnce([
        {
          name: 'main.js',
          duration: 250,
          transferSize: 150000,
          decodedBodySize: 145000
        },
        {
          name: 'vendor.js',
          duration: 200,
          transferSize: 180000,
          decodedBodySize: 175000
        }
      ] as any);

      const bundleMetrics = await measureBundleLoadTime();

      expect(bundleMetrics).toEqual({
        totalLoadTime: 450,
        bundles: expect.arrayContaining([
          {
            name: 'main.js',
            loadTime: 250,
            size: 150000,
            decodedSize: 145000
          },
          {
            name: 'vendor.js',
            loadTime: 200,
            size: 180000,
            decodedSize: 175000
          }
        ]),
        totalSize: 330000,
        timestamp: expect.any(Number)
      });
    });

    it('should identify slow-loading bundles', async () => {
      const slowBundles = await measureBundleLoadTime({ threshold: 200 });
      
      expect(slowBundles).toHaveProperty('slowBundles');
      expect(slowBundles.slowBundles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            loadTime: expect.any(Number),
            exceedsThreshold: true
          })
        ])
      );
    });
  });

  describe('Memory Usage Monitoring', () => {
    it('should measure memory usage', () => {
      const memory = measureMemoryUsage();

      expect(memory).toEqual({
        usedJSHeapSize: 10000000,
        totalJSHeapSize: 20000000,
        jsHeapSizeLimit: 30000000,
        percentUsed: 50,
        timestamp: expect.any(Number)
      });
    });

    it('should detect memory leaks', async () => {
      // Simulate memory growth
      let heapSize = 10000000;
      jest.spyOn(performance, 'memory', 'get').mockImplementation(() => ({
        usedJSHeapSize: heapSize += 1000000,
        totalJSHeapSize: 20000000,
        jsHeapSizeLimit: 30000000
      }));

      const leaks = await detectMemoryLeaks({
        duration: 1000,
        interval: 100,
        threshold: 5 // 5MB growth threshold
      });

      expect(leaks).toEqual({
        detected: true,
        initialMemory: expect.any(Number),
        finalMemory: expect.any(Number),
        growth: expect.any(Number),
        growthRate: expect.any(Number),
        possibleLeaks: expect.any(Array)
      });
    });

    it('should track memory usage over time', () => {
      const memoryTracker = schedulePerformanceCheck({
        metrics: ['memory'],
        interval: 1000
      });

      expect(memoryTracker).toHaveProperty('stop');
      memoryTracker.stop();
    });
  });

  describe('Core Web Vitals', () => {
    it('should measure Time to First Byte (TTFB)', async () => {
      mockGetEntriesByType.mockReturnValueOnce([
        {
          responseStart: 150,
          requestStart: 50
        }
      ] as any);

      const ttfb = await measureTTFB();

      expect(ttfb).toEqual({
        metric: 'TTFB',
        value: 100,
        rating: 'good', // < 800ms
        timestamp: expect.any(Number)
      });
    });

    it('should measure First Contentful Paint (FCP)', async () => {
      mockGetEntriesByName.mockReturnValueOnce([
        {
          startTime: 1200
        }
      ] as any);

      const fcp = await measureFCP();

      expect(fcp).toEqual({
        metric: 'FCP',
        value: 1200,
        rating: 'good', // < 1800ms
        timestamp: expect.any(Number)
      });
    });

    it('should measure Largest Contentful Paint (LCP)', async () => {
      const mockCallback = mockPerformanceObserver.mock.calls[0]?.[0];
      
      const lcp = measureLCP();
      
      // Simulate LCP observation
      if (mockCallback) {
        mockCallback({
          getEntries: () => [{
            startTime: 2300
          }]
        });
      }

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(await lcp).toEqual({
        metric: 'LCP',
        value: 2300,
        rating: 'needs-improvement', // 2500ms > value > 4000ms
        timestamp: expect.any(Number)
      });
    });

    it('should measure Cumulative Layout Shift (CLS)', async () => {
      const cls = await measureCLS();

      expect(cls).toEqual({
        metric: 'CLS',
        value: expect.any(Number),
        rating: expect.stringMatching(/good|needs-improvement|poor/),
        timestamp: expect.any(Number)
      });
    });

    it('should measure Interaction to Next Paint (INP)', async () => {
      const inp = await measureINP();

      expect(inp).toEqual({
        metric: 'INP',
        value: expect.any(Number),
        rating: expect.stringMatching(/good|needs-improvement|poor/),
        timestamp: expect.any(Number)
      });
    });
  });

  describe('FPS Monitoring', () => {
    it('should measure frame rate', async () => {
      const fps = await measureFPS({ duration: 1000 });

      expect(fps).toEqual({
        average: expect.any(Number),
        min: expect.any(Number),
        max: expect.any(Number),
        drops: expect.any(Number),
        timestamp: expect.any(Number)
      });
    });

    it('should detect frame drops', async () => {
      const fps = await measureFPS({ 
        duration: 1000,
        targetFPS: 60 
      });

      expect(fps).toHaveProperty('droppedFrames');
      expect(fps.droppedFrames).toEqual(
        expect.arrayContaining([
          {
            timestamp: expect.any(Number),
            duration: expect.any(Number)
          }
        ])
      );
    });
  });

  describe('User Timing API', () => {
    it('should track custom user timings', () => {
      trackUserTiming('search-start');
      trackUserTiming('search-end');

      expect(mockMark).toHaveBeenCalledWith('search-start');
      expect(mockMark).toHaveBeenCalledWith('search-end');
      expect(mockMeasure).toHaveBeenCalledWith(
        'search-duration',
        'search-start',
        'search-end'
      );
    });

    it('should measure custom operations', async () => {
      const result = await benchmarkFunction(
        'processContract',
        async () => {
          // Simulate processing
          await new Promise(resolve => setTimeout(resolve, 100));
          return { processed: true };
        }
      );

      expect(result).toEqual({
        name: 'processContract',
        duration: expect.any(Number),
        result: { processed: true },
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Performance Thresholds', () => {
    it('should set performance thresholds', () => {
      setPerformanceThresholds({
        renderTime: 50,
        apiLatency: 200,
        bundleSize: 200000,
        memoryUsage: 50,
        fps: 55,
        ttfb: 800,
        fcp: 1800,
        lcp: 2500,
        cls: 0.1,
        inp: 200
      });

      const thresholds = checkPerformanceThresholds();
      expect(thresholds).toHaveProperty('renderTime');
      expect(thresholds.renderTime).toBe(50);
    });

    it('should check if metrics exceed thresholds', async () => {
      setPerformanceThresholds({
        renderTime: 16,
        apiLatency: 100
      });

      mockPerformanceNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1020); // 20ms render time

      await measureRenderTime('SlowComponent');
      
      const violations = checkPerformanceThresholds();
      expect(violations.violations).toContainEqual(
        expect.objectContaining({
          metric: 'renderTime',
          threshold: 16,
          actual: expect.any(Number),
          component: 'SlowComponent'
        })
      );
    });
  });

  describe('Performance Comparison', () => {
    it('should compare performance between versions', async () => {
      const baselineMetrics = {
        renderTime: 45,
        apiLatency: 180,
        bundleSize: 195000
      };

      const currentMetrics = {
        renderTime: 40,
        apiLatency: 200,
        bundleSize: 185000
      };

      const comparison = comparePerformance(baselineMetrics, currentMetrics);

      expect(comparison).toEqual({
        renderTime: {
          baseline: 45,
          current: 40,
          difference: -5,
          percentChange: -11.11,
          improved: true
        },
        apiLatency: {
          baseline: 180,
          current: 200,
          difference: 20,
          percentChange: 11.11,
          improved: false
        },
        bundleSize: {
          baseline: 195000,
          current: 185000,
          difference: -10000,
          percentChange: -5.13,
          improved: true
        }
      });
    });

    it('should generate performance comparison report', () => {
      const report = generatePerformanceReport({
        includeComparison: true,
        baseline: 'v1.0.0'
      });

      expect(report).toEqual({
        summary: expect.any(Object),
        metrics: expect.any(Object),
        comparison: expect.any(Object),
        recommendations: expect.any(Array),
        timestamp: expect.any(String)
      });
    });
  });

  describe('Network Speed Detection', () => {
    it('should measure network speed', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => '1048576' // 1MB
        }
      });

      mockPerformanceNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(2000); // 1 second

      const speed = await measureNetworkSpeed();

      expect(speed).toEqual({
        downloadSpeed: 8.39, // Mbps
        latency: expect.any(Number),
        connectionType: expect.any(String),
        timestamp: expect.any(Number)
      });
    });

    it('should classify connection quality', async () => {
      const speed = await measureNetworkSpeed();
      
      expect(speed.connectionType).toMatch(/slow-2g|2g|3g|4g|wifi/);
    });
  });

  describe('Optimization Suggestions', () => {
    it('should provide optimization suggestions based on metrics', () => {
      const metrics = {
        renderTime: 100,
        apiLatency: 500,
        bundleSize: 500000,
        memoryUsage: 80,
        fps: 30
      };

      const suggestions = optimizationSuggestions(metrics);

      expect(suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: expect.any(String),
            severity: expect.stringMatching(/low|medium|high|critical/),
            issue: expect.any(String),
            suggestion: expect.any(String),
            impact: expect.any(String)
          })
        ])
      );
    });

    it('should prioritize critical optimizations', () => {
      const suggestions = optimizationSuggestions({
        renderTime: 200,
        memoryUsage: 95
      });

      const critical = suggestions.filter(s => s.severity === 'critical');
      expect(critical.length).toBeGreaterThan(0);
      expect(critical[0].category).toMatch(/render|memory/);
    });
  });

  describe('Performance Data Export', () => {
    it('should export performance data in JSON format', () => {
      const data = exportPerformanceData('json');
      
      expect(data).toEqual({
        format: 'json',
        data: expect.any(Object),
        metadata: {
          exportDate: expect.any(String),
          version: expect.any(String)
        }
      });
    });

    it('should export performance data in CSV format', () => {
      const data = exportPerformanceData('csv');
      
      expect(data).toEqual({
        format: 'csv',
        data: expect.any(String),
        metadata: {
          exportDate: expect.any(String),
          version: expect.any(String)
        }
      });
    });

    it('should clear performance data', () => {
      clearPerformanceData();
      const metrics = getPerformanceMetrics();
      
      expect(metrics).toEqual({
        renders: {},
        apiLatency: {},
        memory: [],
        webVitals: {},
        userTimings: {}
      });
    });
  });

  describe('Performance Monitoring Scheduler', () => {
    it('should schedule periodic performance checks', () => {
      const monitor = schedulePerformanceCheck({
        metrics: ['render', 'memory', 'api'],
        interval: 5000,
        callback: (metrics) => {
          expect(metrics).toHaveProperty('render');
          expect(metrics).toHaveProperty('memory');
          expect(metrics).toHaveProperty('api');
        }
      });

      expect(monitor).toHaveProperty('stop');
      expect(monitor).toHaveProperty('pause');
      expect(monitor).toHaveProperty('resume');
      
      monitor.stop();
    });

    it('should trigger alerts on threshold violations', () => {
      const alertCallback = jest.fn();
      
      setPerformanceThresholds({
        renderTime: 10
      });

      const monitor = schedulePerformanceCheck({
        metrics: ['render'],
        interval: 1000,
        alertOnViolation: true,
        onAlert: alertCallback
      });

      // Simulate slow render
      mockPerformanceNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1020);

      measureRenderTime('SlowComponent');

      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          metric: 'renderTime',
          violation: true
        })
      );

      monitor.stop();
    });
  });
});