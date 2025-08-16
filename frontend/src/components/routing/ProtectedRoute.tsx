/**
 * ProtectedRoute component
 * Handles authentication and authorization for protected routes
 */
import { ReactNode, useEffect } from 'react'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'

interface ProtectedRouteProps {
  children: ReactNode
  redirectTo?: string
  requireRole?: string | string[]
  requirePermission?: string | string[]
  requireAllPermissions?: boolean
  validateTenant?: boolean
  loadingComponent?: ReactNode
  unauthorizedComponent?: ReactNode
}

export function ProtectedRoute({
  children,
  redirectTo = '/login',
  requireRole,
  requirePermission,
  requireAllPermissions = false,
  validateTenant = false,
  loadingComponent,
  unauthorizedComponent
}: ProtectedRouteProps) {
  const location = useLocation()
  const params = useParams()
  const navigate = useNavigate()
  const { 
    isAuthenticated, 
    user, 
    hasRole, 
    hasPermission,
    isLoading 
  } = useAuthStore()

  // Show loading state
  if (isLoading) {
    return (
      <>
        {loadingComponent || (
          <div className="flex items-center justify-center min-h-screen">
            <div data-testid="loading-spinner" className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}
      </>
    )
  }

  // Check authentication
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate(redirectTo, { replace: true, state: { from: location.pathname } })
    }
  }, [isLoading, isAuthenticated, redirectTo, location.pathname, navigate])

  if (!isAuthenticated || !user) {
    return null
  }

  // Check tenant validation
  if (validateTenant && params.tenantId) {
    const requestedTenantId = parseInt(params.tenantId)
    const userTenantId = user.tenant_id
    const isSuperuser = user.is_superuser

    if (!isSuperuser && userTenantId !== requestedTenantId) {
      return (
        <>
          {unauthorizedComponent || (
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Not Authorized</h2>
                <p className="text-gray-600">You do not have access to this tenant's resources.</p>
              </div>
            </div>
          )}
        </>
      )
    }
  }

  // Check role requirements
  if (requireRole) {
    const roles = Array.isArray(requireRole) ? requireRole : [requireRole]
    const hasRequiredRole = roles.some(role => hasRole(role))

    if (!hasRequiredRole) {
      return (
        <>
          {unauthorizedComponent || (
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Not Authorized</h2>
                <p className="text-gray-600">You do not have the required role to access this page.</p>
              </div>
            </div>
          )}
        </>
      )
    }
  }

  // Check permission requirements
  if (requirePermission) {
    const permissions = Array.isArray(requirePermission) ? requirePermission : [requirePermission]
    
    let hasRequiredPermissions: boolean
    if (requireAllPermissions) {
      // AND logic - must have all permissions
      hasRequiredPermissions = permissions.every(permission => hasPermission(permission))
    } else {
      // OR logic - must have at least one permission
      hasRequiredPermissions = permissions.some(permission => hasPermission(permission))
    }

    if (!hasRequiredPermissions) {
      return (
        <>
          {unauthorizedComponent || (
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Not Authorized</h2>
                <p className="text-gray-600">You do not have the required permissions to access this page.</p>
              </div>
            </div>
          )}
        </>
      )
    }
  }

  // All checks passed, render children
  return <>{children}</>
}

// Export a higher-order component for easier use with React Router
export function withProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<ProtectedRouteProps, 'children'>
) {
  return (props: P) => (
    <ProtectedRoute {...options}>
      <Component {...props} />
    </ProtectedRoute>
  )
}
