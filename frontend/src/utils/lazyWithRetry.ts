/**
 * Lazy loading utilities with retry logic
 * Following TDD - GREEN phase: Implementation to pass tests
 */

import React, { ComponentType, lazy } from 'react';

interface RetryOptions {
  retries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Enhanced lazy loading with retry logic for failed chunk loads
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: RetryOptions = {}
): React.LazyExoticComponent<T> {
  const { retries = 3, retryDelay = 1000, onRetry } = options;
  
  const retryImport = async (attempt = 0): Promise<{ default: T }> => {
    try {
      return await importFn();
    } catch (error) {
      if (attempt < retries) {
        onRetry?.(attempt + 1, error as Error);
        
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, retryDelay * Math.pow(2, attempt))
        );
        
        // Clear module cache if possible (for Vite/Webpack)
        if ('webpackChunkName' in importFn) {
          // @ts-ignore - webpack specific
          delete window.__webpack_require__.cache[importFn.toString()];
        }
        
        return retryImport(attempt + 1);
      }
      
      // After max retries, throw error
      throw error;
    }
  };
  
  const LazyComponent = lazy(retryImport);
  
  // Mark as lazy for testing
  (LazyComponent as any)._isLazy = true;
  
  return LazyComponent;
}

/**
 * Lazy loading with preload capability
 */
export function lazyWithPreload<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> & { preload: () => Promise<void> } {
  const LazyComponent = lazyWithRetry(importFn);
  
  // Add preload method
  (LazyComponent as any).preload = async () => {
    try {
      await importFn();
    } catch (error) {
      console.error('Failed to preload component:', error);
    }
  };
  
  return LazyComponent as any;
}

/**
 * Intersection Observer based lazy loading
 */
export class LazyLoader {
  private observer: IntersectionObserver;
  private callbacks: Map<Element, () => void>;
  
  constructor(options: IntersectionObserverInit = {}) {
    this.callbacks = new Map();
    
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const callback = this.callbacks.get(entry.target);
          if (callback) {
            callback();
            this.unobserve(entry.target);
          }
        }
      });
    }, {
      rootMargin: '50px',
      ...options
    });
  }
  
  observe(element: Element, callback: () => void) {
    this.callbacks.set(element, callback);
    this.observer.observe(element);
  }
  
  unobserve(element: Element) {
    this.callbacks.delete(element);
    this.observer.unobserve(element);
  }
  
  disconnect() {
    this.observer.disconnect();
    this.callbacks.clear();
  }
}

/**
 * Resource hints for prefetching chunks
 */
export function prefetchChunk(chunkName: string) {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = `/assets/${chunkName}.js`;
  document.head.appendChild(link);
}

/**
 * Preload critical chunks
 */
export function preloadChunk(chunkName: string) {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'script';
  link.href = `/assets/${chunkName}.js`;
  document.head.appendChild(link);
}

/**
 * Dynamic import with timeout
 */
export async function importWithTimeout<T>(
  importFn: () => Promise<T>,
  timeout = 10000
): Promise<T> {
  return Promise.race([
    importFn(),
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Import timeout')), timeout)
    )
  ]);
}

/**
 * Batch lazy loading for multiple components
 */
export function lazyBatch<T extends Record<string, ComponentType<any>>>(
  imports: Record<string, () => Promise<{ default: ComponentType<any> }>>
): Record<string, React.LazyExoticComponent<ComponentType<any>>> {
  const result: Record<string, React.LazyExoticComponent<ComponentType<any>>> = {};
  
  for (const [key, importFn] of Object.entries(imports)) {
    result[key] = lazyWithRetry(importFn);
  }
  
  return result;
}