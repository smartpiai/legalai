/**
 * Bundle Optimization Tests
 * Following TDD - RED phase: Writing comprehensive tests first
 * Tests for code splitting, lazy loading, and bundle optimization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React, { Suspense } from 'react';

// Mock dynamic imports
vi.mock('../utils/lazyWithRetry', () => ({
  lazyWithRetry: vi.fn((importFn) => React.lazy(importFn)),
  lazyWithPreload: vi.fn((importFn) => {
    const Component = React.lazy(importFn);
    (Component as any).preload = importFn;
    return Component;
  }),
}));

describe('Bundle Optimization', () => {
  describe('Code Splitting', () => {
    it('should lazy load route components', async () => {
      const { AppRouter } = await import('../router/AppRouter');
      
      render(
        React.createElement(BrowserRouter, {},
          React.createElement(Suspense, { fallback: React.createElement('div', {}, 'Loading...') },
            React.createElement(AppRouter)))
      );
      
      // Should show loading state initially
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      
      // Should load component
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });

    it('should split vendor chunks correctly', () => {
      const { getBundleAnalysis } = require('../utils/bundleAnalyzer');
      const analysis = getBundleAnalysis();
      
      // Vendor chunk should exist
      expect(analysis.chunks).toContainEqual(
        expect.objectContaining({
          name: 'vendor',
          modules: expect.arrayContaining(['react', 'react-dom'])
        })
      );
      
      // Router chunk should be separate
      expect(analysis.chunks).toContainEqual(
        expect.objectContaining({
          name: 'router',
          modules: expect.arrayContaining(['react-router-dom'])
        })
      );
    });

    it('should create separate chunks for major features', () => {
      const { getBundleAnalysis } = require('../utils/bundleAnalyzer');
      const analysis = getBundleAnalysis();
      
      // Each major feature should have its own chunk
      const featureChunks = [
        'contracts',
        'templates',
        'analytics',
        'workflow',
        'admin'
      ];
      
      featureChunks.forEach(feature => {
        expect(analysis.chunks).toContainEqual(
          expect.objectContaining({
            name: expect.stringContaining(feature)
          })
        );
      });
    });

    it('should keep initial bundle size under threshold', () => {
      const { getInitialBundleSize } = require('../utils/bundleAnalyzer');
      const initialSize = getInitialBundleSize();
      
      // Initial bundle should be under 200KB
      expect(initialSize).toBeLessThan(200 * 1024);
    });
  });

  describe('Lazy Loading with Retry', () => {
    it('should retry failed chunk loads', async () => {
      const mockImport = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ default: () => React.createElement('div', {}, 'Component Loaded') });
      
      const { lazyWithRetry } = await import('../utils/lazyWithRetry');
      const LazyComponent = lazyWithRetry(mockImport);
      
      render(
        React.createElement(Suspense, { fallback: React.createElement('div', {}, 'Loading...') },
          React.createElement(LazyComponent))
      );
      
      await waitFor(() => {
        expect(screen.getByText('Component Loaded')).toBeInTheDocument();
      });
      
      // Should have retried
      expect(mockImport).toHaveBeenCalledTimes(2);
    });

    it('should show error boundary after max retries', async () => {
      const mockImport = vi.fn()
        .mockRejectedValue(new Error('Network error'));
      
      const { lazyWithRetry } = await import('../utils/lazyWithRetry');
      const LazyComponent = lazyWithRetry(mockImport, { retries: 3 });
      
      const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
        const [hasError, setHasError] = React.useState(false);
        
        React.useEffect(() => {
          const handleError = () => setHasError(true);
          window.addEventListener('unhandledrejection', handleError);
          return () => window.removeEventListener('unhandledrejection', handleError);
        }, []);
        
        if (hasError) return React.createElement('div', {}, 'Failed to load component');
        return React.createElement(React.Fragment, {}, children);
      };
      
      render(
        React.createElement(ErrorBoundary, {},
          React.createElement(Suspense, { fallback: React.createElement('div', {}, 'Loading...') },
            React.createElement(LazyComponent)))
      );
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load component')).toBeInTheDocument();
      });
      
      // Should have tried 3 times + 1 initial
      expect(mockImport).toHaveBeenCalledTimes(4);
    });
  });

  describe('Route-based Code Splitting', () => {
    it('should lazy load dashboard route', async () => {
      const { DashboardRoute } = await import('../routes/DashboardRoute');
      
      expect(DashboardRoute).toBeDefined();
      expect(typeof DashboardRoute).toBe('object');
      expect(DashboardRoute.preload).toBeDefined();
    });

    it('should lazy load contracts route', async () => {
      const { ContractsRoute } = await import('../routes/ContractsRoute');
      
      expect(ContractsRoute).toBeDefined();
      expect(ContractsRoute.preload).toBeDefined();
    });

    it('should lazy load analytics route', async () => {
      const { AnalyticsRoute } = await import('../routes/AnalyticsRoute');
      
      expect(AnalyticsRoute).toBeDefined();
      expect(AnalyticsRoute.preload).toBeDefined();
    });

    it('should preload route on hover', async () => {
      const preloadSpy = vi.fn();
      const { ContractsRoute } = await import('../routes/ContractsRoute');
      ContractsRoute.preload = preloadSpy;
      
      const { NavLink } = await import('../components/navigation/NavLink');
      
      const { container } = render(
        React.createElement(BrowserRouter, {},
          React.createElement(NavLink, { to: "/contracts", preload: true }, 'Contracts'))
      );
      
      const link = container.querySelector('a');
      
      // Simulate hover
      link?.dispatchEvent(new MouseEvent('mouseenter'));
      
      await waitFor(() => {
        expect(preloadSpy).toHaveBeenCalled();
      });
    });
  });

  describe('Component-level Code Splitting', () => {
    it('should lazy load heavy components', async () => {
      const components = [
        'PDFViewer',
        'InteractiveGraphExplorer',
        'PerformanceTracking',
        'ContractEditor',
        'TemplateBuilder'
      ];
      
      for (const componentName of components) {
        const module = await import(`../components/heavy/${componentName}`);
        expect(module[componentName]).toBeDefined();
        expect(module[componentName]._isLazy).toBe(true);
      }
    });

    it('should use intersection observer for lazy loading', async () => {
      const mockObserve = vi.fn();
      const mockUnobserve = vi.fn();
      
      global.IntersectionObserver = vi.fn().mockImplementation(() => ({
        observe: mockObserve,
        unobserve: mockUnobserve,
        disconnect: vi.fn(),
      }));
      
      const { LazyLoadWrapper } = await import('../components/LazyLoadWrapper');
      
      render(
        React.createElement(LazyLoadWrapper, {},
          React.createElement('div', {}, 'Content'))
      );
      
      expect(mockObserve).toHaveBeenCalled();
    });
  });

  describe('Bundle Analysis', () => {
    it('should generate bundle stats', () => {
      const { generateBundleStats } = require('../utils/bundleAnalyzer');
      const stats = generateBundleStats();
      
      expect(stats).toHaveProperty('assets');
      expect(stats).toHaveProperty('chunks');
      expect(stats).toHaveProperty('modules');
      expect(stats).toHaveProperty('totalSize');
    });

    it('should identify duplicate dependencies', () => {
      const { findDuplicates } = require('../utils/bundleAnalyzer');
      const duplicates = findDuplicates();
      
      // Should not have duplicate React versions
      const reactDuplicates = duplicates.filter((d: any) => d.name === 'react');
      expect(reactDuplicates.length).toBeLessThanOrEqual(1);
    });

    it('should optimize common chunks', () => {
      const { getCommonChunks } = require('../utils/bundleAnalyzer');
      const commonChunks = getCommonChunks();
      
      // Common chunks should be properly extracted
      expect(commonChunks).toContainEqual(
        expect.objectContaining({
          name: 'common',
          minChunks: 2
        })
      );
    });
  });

  describe('Performance Optimization', () => {
    it('should implement resource hints', () => {
      const links = document.querySelectorAll('link[rel="prefetch"], link[rel="preload"]');
      
      // Should have resource hints for critical chunks
      expect(links.length).toBeGreaterThan(0);
    });

    it('should use web workers for heavy computations', async () => {
      const { ContractAnalyzer } = await import('../workers/ContractAnalyzer');
      
      const analyzer = new ContractAnalyzer();
      const result = await analyzer.analyze({ content: 'test' });
      
      expect(result).toBeDefined();
      expect(analyzer.worker).toBeInstanceOf(Worker);
    });

    it('should implement service worker for caching', async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      
      expect(registration).toBeDefined();
      expect(registration?.active?.scriptURL).toContain('service-worker.js');
    });
  });

  describe('Tree Shaking', () => {
    it('should remove unused exports', () => {
      const { getBundleAnalysis } = require('../utils/bundleAnalyzer');
      const analysis = getBundleAnalysis();
      
      // Check that unused utils are not included
      const utilsModule = analysis.modules.find((m: any) => m.name.includes('utils'));
      
      // Should only include used exports
      expect(utilsModule.usedExports).not.toContain('unusedFunction');
    });

    it('should optimize lodash imports', () => {
      const { getBundleAnalysis } = require('../utils/bundleAnalyzer');
      const analysis = getBundleAnalysis();
      
      // Should use specific lodash imports, not the entire library
      const lodashModules = analysis.modules.filter((m: any) => m.name.includes('lodash'));
      
      lodashModules.forEach((module: any) => {
        expect(module.name).toMatch(/lodash\/\w+/); // e.g., lodash/debounce
      });
    });
  });

  describe('CSS Optimization', () => {
    it('should extract critical CSS', () => {
      const { getCriticalCSS } = require('../utils/cssOptimizer');
      const criticalCSS = getCriticalCSS();
      
      expect(criticalCSS).toBeDefined();
      expect(criticalCSS.length).toBeLessThan(14 * 1024); // Under 14KB
    });

    it('should purge unused CSS', () => {
      const { getUnusedCSS } = require('../utils/cssOptimizer');
      const unusedCSS = getUnusedCSS();
      
      // Should have minimal unused CSS
      expect(unusedCSS.percentage).toBeLessThan(10);
    });

    it('should implement CSS modules for component styles', () => {
      const { ContractCard } = require('../components/contracts/ContractCard');
      
      expect(ContractCard.styles).toBeDefined();
      expect(ContractCard.styles.container).toMatch(/^ContractCard_container_\w+$/);
    });
  });

  describe('Image Optimization', () => {
    it('should lazy load images', () => {
      const images = document.querySelectorAll('img[loading="lazy"]');
      
      // All non-critical images should be lazy loaded
      expect(images.length).toBeGreaterThan(0);
    });

    it('should use responsive images', () => {
      const images = document.querySelectorAll('img[srcset]');
      
      // Images should have srcset for responsive loading
      expect(images.length).toBeGreaterThan(0);
    });

    it('should optimize image formats', () => {
      const images = document.querySelectorAll('picture source[type="image/webp"]');
      
      // Should serve WebP where supported
      expect(images.length).toBeGreaterThan(0);
    });
  });

  describe('Caching Strategy', () => {
    it('should implement proper cache headers', () => {
      const { getCacheHeaders } = require('../utils/cacheStrategy');
      const headers = getCacheHeaders();
      
      // Static assets should have long cache
      expect(headers.static['Cache-Control']).toContain('max-age=31536000');
      
      // HTML should not be cached
      expect(headers.html['Cache-Control']).toContain('no-cache');
    });

    it('should version assets for cache busting', () => {
      const { getAssetManifest } = require('../utils/assetManifest');
      const manifest = getAssetManifest();
      
      // All assets should have hash in filename
      Object.values(manifest).forEach((filename: any) => {
        expect(filename).toMatch(/\.[a-f0-9]{8}\./);
      });
    });
  });
});