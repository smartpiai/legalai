/**
 * Router configuration with lazy loading and code splitting
 * Implements protected routes and role-based access
 */
import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom'
import { ProtectedRoute } from '@/components/routing/ProtectedRoute'

// Layout components (loaded immediately)
import { MainLayout } from '@/layouts/MainLayout'
import { AuthLayout } from '@/layouts/AuthLayout'

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
)

// Lazy load pages for code splitting
const LegalDashboard = lazy(() => import('@/pages/LegalDashboard'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'))

// Dashboard pages
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const ProfilePage = lazy(() => import('@/pages/dashboard/ProfilePage'))

// Contract pages
const ContractsListPage = lazy(() => import('@/pages/contracts/ContractsListPage'))
const ContractDetailsPage = lazy(() => import('@/pages/contracts/ContractDetailsPage'))
const ContractEditPage = lazy(() => import('@/pages/contracts/ContractEditPage'))
const ContractCreatePage = lazy(() => import('@/pages/contracts/ContractCreatePage'))

// Document pages
const DocumentsListPage = lazy(() => import('@/pages/documents/DocumentsListPage'))
const DocumentUploadPage = lazy(() => import('@/pages/documents/DocumentUploadPage'))
const DocumentViewerPage = lazy(() => import('@/pages/documents/DocumentViewerPage'))

// Template pages
const TemplatesListPage = lazy(() => import('@/pages/templates/TemplatesListPage'))
const TemplateEditorPage = lazy(() => import('@/pages/templates/TemplateEditorPage'))
const TemplateCreatePage = lazy(() => import('@/pages/templates/TemplateCreatePage'))

// Workflow pages
const WorkflowsListPage = lazy(() => import('@/pages/workflows/WorkflowsListPage'))
const WorkflowDesignerPage = lazy(() => import('@/pages/workflows/WorkflowDesignerPage'))
const WorkflowTasksPage = lazy(() => import('@/pages/workflows/WorkflowTasksPage'))

// Admin pages
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const UsersManagementPage = lazy(() => import('@/pages/admin/UsersManagementPage'))
const TenantsManagementPage = lazy(() => import('@/pages/admin/TenantsManagementPage'))
const RolesPermissionsPage = lazy(() => import('@/pages/admin/RolesPermissionsPage'))
const SystemSettingsPage = lazy(() => import('@/pages/admin/SystemSettingsPage'))

// Error pages
const NotFoundPage = lazy(() => import('@/pages/errors/NotFoundPage'))
const UnauthorizedPage = lazy(() => import('@/pages/errors/UnauthorizedPage'))
const ServerErrorPage = lazy(() => import('@/pages/errors/ServerErrorPage'))

// Wrapper component for lazy loaded pages
const LazyPage = ({ Component }: { Component: React.LazyExoticComponent<any> }) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
)

// Router configuration
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Outlet />,
    children: [
      // Public routes with AuthLayout
      {
        element: <AuthLayout />,
        children: [
          {
            path: 'login',
            element: <LazyPage Component={LoginPage} />
          },
          {
            path: 'register',
            element: <LazyPage Component={RegisterPage} />
          },
          {
            path: 'forgot-password',
            element: <LazyPage Component={ForgotPasswordPage} />
          },
          {
            path: 'reset-password',
            element: <LazyPage Component={ResetPasswordPage} />
          }
        ]
      },
      
      // Protected routes with MainLayout
      {
        element: (
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <LazyPage Component={LegalDashboard} />
          },
          {
            path: 'profile',
            element: <LazyPage Component={ProfilePage} />
          },
          
          // Contracts section
          {
            path: 'contracts',
            children: [
              {
                index: true,
                element: <LazyPage Component={ContractsListPage} />
              },
              {
                path: 'new',
                element: (
                  <ProtectedRoute requirePermission="contracts:create">
                    <LazyPage Component={ContractCreatePage} />
                  </ProtectedRoute>
                )
              },
              {
                path: ':id',
                element: <LazyPage Component={ContractDetailsPage} />
              },
              {
                path: ':id/edit',
                element: (
                  <ProtectedRoute requirePermission="contracts:update">
                    <LazyPage Component={ContractEditPage} />
                  </ProtectedRoute>
                )
              }
            ]
          },
          
          // Documents section
          {
            path: 'documents',
            children: [
              {
                index: true,
                element: <LazyPage Component={DocumentsListPage} />
              },
              {
                path: 'upload',
                element: (
                  <ProtectedRoute requirePermission="documents:create">
                    <LazyPage Component={DocumentUploadPage} />
                  </ProtectedRoute>
                )
              },
              {
                path: ':id',
                element: <LazyPage Component={DocumentViewerPage} />
              }
            ]
          },
          
          // Templates section
          {
            path: 'templates',
            children: [
              {
                index: true,
                element: <LazyPage Component={TemplatesListPage} />
              },
              {
                path: 'new',
                element: (
                  <ProtectedRoute requirePermission="templates:create">
                    <LazyPage Component={TemplateCreatePage} />
                  </ProtectedRoute>
                )
              },
              {
                path: ':id/edit',
                element: (
                  <ProtectedRoute requirePermission="templates:update">
                    <LazyPage Component={TemplateEditorPage} />
                  </ProtectedRoute>
                )
              }
            ]
          },
          
          // Workflows section
          {
            path: 'workflows',
            children: [
              {
                index: true,
                element: <LazyPage Component={WorkflowsListPage} />
              },
              {
                path: 'designer',
                element: (
                  <ProtectedRoute requirePermission="workflows:create">
                    <LazyPage Component={WorkflowDesignerPage} />
                  </ProtectedRoute>
                )
              },
              {
                path: 'tasks',
                element: <LazyPage Component={WorkflowTasksPage} />
              }
            ]
          },
          
          // Admin section - requires admin role
          {
            path: 'admin',
            element: (
              <ProtectedRoute requireRole="admin">
                <Outlet />
              </ProtectedRoute>
            ),
            children: [
              {
                index: true,
                element: <LazyPage Component={AdminDashboardPage} />
              },
              {
                path: 'users',
                element: <LazyPage Component={UsersManagementPage} />
              },
              {
                path: 'tenants',
                element: (
                  <ProtectedRoute requireRole="superuser">
                    <LazyPage Component={TenantsManagementPage} />
                  </ProtectedRoute>
                )
              },
              {
                path: 'roles-permissions',
                element: <LazyPage Component={RolesPermissionsPage} />
              },
              {
                path: 'settings',
                element: <LazyPage Component={SystemSettingsPage} />
              }
            ]
          }
        ]
      },
      
      // Error pages
      {
        path: 'unauthorized',
        element: <LazyPage Component={UnauthorizedPage} />
      },
      {
        path: 'error',
        element: <LazyPage Component={ServerErrorPage} />
      },
      {
        path: '*',
        element: <LazyPage Component={NotFoundPage} />
      }
    ]
  }
])

// Route mapping for breadcrumbs
export const routeMapping: Record<string, string> = {
  '/': 'Home',
  '/dashboard': 'Dashboard',
  '/profile': 'Profile',
  '/contracts': 'Contracts',
  '/contracts/new': 'New Contract',
  '/contracts/:id': 'Contract Details',
  '/contracts/:id/edit': 'Edit Contract',
  '/documents': 'Documents',
  '/documents/upload': 'Upload Document',
  '/documents/:id': 'Document Viewer',
  '/templates': 'Templates',
  '/templates/new': 'New Template',
  '/templates/:id/edit': 'Edit Template',
  '/workflows': 'Workflows',
  '/workflows/designer': 'Workflow Designer',
  '/workflows/tasks': 'My Tasks',
  '/admin': 'Admin',
  '/admin/users': 'User Management',
  '/admin/tenants': 'Tenant Management',
  '/admin/roles-permissions': 'Roles & Permissions',
  '/admin/settings': 'System Settings'
}

// Main Router Provider component
export function Router() {
  return <RouterProvider router={router} />
}
