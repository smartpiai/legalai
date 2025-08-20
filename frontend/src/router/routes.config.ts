/**
 * Route configuration with code splitting
 * Following TDD - GREEN phase: Implementing lazy loaded routes
 */

import React from 'react';
import { lazyWithPreload } from '../utils/lazyWithRetry';
import { RouteObject } from 'react-router-dom';

// Lazy load route components with preload capability
export const DashboardRoute = lazyWithPreload(
  () => import(/* webpackChunkName: "dashboard" */ '../pages/Dashboard')
);

export const ContractsRoute = lazyWithPreload(
  () => import(/* webpackChunkName: "contracts" */ '../pages/Contracts')
);

export const TemplatesRoute = lazyWithPreload(
  () => import(/* webpackChunkName: "templates" */ '../pages/Templates')
);

export const AnalyticsRoute = lazyWithPreload(
  () => import(/* webpackChunkName: "analytics" */ '../pages/Analytics')
);

export const WorkflowRoute = lazyWithPreload(
  () => import(/* webpackChunkName: "workflow" */ '../pages/Workflow')
);

export const AdminRoute = lazyWithPreload(
  () => import(/* webpackChunkName: "admin" */ '../pages/Admin')
);

export const ProfileRoute = lazyWithPreload(
  () => import(/* webpackChunkName: "profile" */ '../pages/Profile')
);

export const SettingsRoute = lazyWithPreload(
  () => import(/* webpackChunkName: "settings" */ '../pages/Settings')
);

// Heavy components lazy loaded
export const PDFViewerComponent = lazyWithPreload(
  () => import(/* webpackChunkName: "pdf-viewer" */ '../components/heavy/PDFViewer')
);

export const InteractiveGraphExplorerComponent = lazyWithPreload(
  () => import(/* webpackChunkName: "graph-explorer" */ '../components/heavy/InteractiveGraphExplorer')
);

export const PerformanceTrackingComponent = lazyWithPreload(
  () => import(/* webpackChunkName: "performance" */ '../components/heavy/PerformanceTracking')
);

export const ContractEditorComponent = lazyWithPreload(
  () => import(/* webpackChunkName: "contract-editor" */ '../components/heavy/ContractEditor')
);

export const TemplateBuilderComponent = lazyWithPreload(
  () => import(/* webpackChunkName: "template-builder" */ '../components/heavy/TemplateBuilder')
);

// Route configuration
export const routes: RouteObject[] = [
  {
    path: '/',
    element: React.createElement(DashboardRoute),
    children: []
  },
  {
    path: '/contracts',
    element: React.createElement(ContractsRoute),
    children: [
      {
        path: ':id',
        element: React.createElement(ContractEditorComponent)
      },
      {
        path: ':id/pdf',
        element: React.createElement(PDFViewerComponent)
      }
    ]
  },
  {
    path: '/templates',
    element: React.createElement(TemplatesRoute),
    children: [
      {
        path: 'builder',
        element: React.createElement(TemplateBuilderComponent)
      }
    ]
  },
  {
    path: '/analytics',
    element: React.createElement(AnalyticsRoute),
    children: [
      {
        path: 'performance',
        element: React.createElement(PerformanceTrackingComponent)
      },
      {
        path: 'graph',
        element: React.createElement(InteractiveGraphExplorerComponent)
      }
    ]
  },
  {
    path: '/workflow',
    element: React.createElement(WorkflowRoute)
  },
  {
    path: '/admin',
    element: React.createElement(AdminRoute)
  },
  {
    path: '/profile',
    element: React.createElement(ProfileRoute)
  },
  {
    path: '/settings',
    element: React.createElement(SettingsRoute)
  }
];

// Preload strategies
export const preloadStrategies = {
  // Preload on hover
  onHover: (route: typeof DashboardRoute) => {
    return {
      onMouseEnter: () => route.preload(),
      onFocus: () => route.preload()
    };
  },
  
  // Preload on visibility
  onVisible: (route: typeof DashboardRoute) => {
    if ('IntersectionObserver' in window) {
      return (element: Element) => {
        const observer = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting) {
              route.preload();
              observer.disconnect();
            }
          },
          { rootMargin: '100px' }
        );
        observer.observe(element);
      };
    }
  },
  
  // Preload after idle
  onIdle: (route: typeof DashboardRoute) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => route.preload());
    } else {
      setTimeout(() => route.preload(), 2000);
    }
  },
  
  // Preload critical routes immediately
  immediate: (routes: Array<typeof DashboardRoute>) => {
    routes.forEach(route => route.preload());
  }
};

// Export for route components
export { DashboardRoute, ContractsRoute, AnalyticsRoute };