/**
 * Tests for ProtectedRoute component
 * Following TDD approach - tests written first
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { useAuthStore } from '../../store/auth'

// Mock the auth store
vi.mock('../../store/auth', () => ({
  useAuthStore: vi.fn()
}))

// Mock navigate function
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentication checks', () => {
    it('should render children when user is authenticated', () => {
      // Mock authenticated state
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: 1,
          email: 'user@example.com',
          tenant_id: 1,
          roles: ['user'],
          permissions: []
        },
        hasRole: vi.fn(),
        hasPermission: vi.fn()
      } as any)

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })

    it('should redirect to login when user is not authenticated', async () => {
      // Mock unauthenticated state
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: false,
        user: null,
        hasRole: vi.fn(),
        hasPermission: vi.fn()
      } as any)

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', {
          replace: true,
          state: { from: '/protected' }
        })
      })
    })

    it('should redirect to custom path when specified', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: false,
        user: null,
        hasRole: vi.fn(),
        hasPermission: vi.fn()
      } as any)

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route
              path="/admin"
              element={
                <ProtectedRoute redirectTo="/signin">
                  <div>Admin Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/signin', {
          replace: true,
          state: { from: '/admin' }
        })
      })
    })
  })

  describe('Role-based access control', () => {
    it('should render when user has required role', () => {
      const hasRole = vi.fn().mockReturnValue(true)
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: 1,
          email: 'admin@example.com',
          tenant_id: 1,
          roles: ['admin'],
          permissions: []
        },
        hasRole,
        hasPermission: vi.fn()
      } as any)

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireRole="admin">
                  <div>Admin Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Admin Content')).toBeInTheDocument()
      expect(hasRole).toHaveBeenCalledWith('admin')
    })

    it('should show unauthorized when user lacks required role', () => {
      const hasRole = vi.fn().mockReturnValue(false)
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: 1,
          email: 'user@example.com',
          tenant_id: 1,
          roles: ['user'],
          permissions: []
        },
        hasRole,
        hasPermission: vi.fn()
      } as any)

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireRole="admin">
                  <div>Admin Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
      expect(screen.getByText(/not authorized/i)).toBeInTheDocument()
    })

    it('should check multiple roles with OR logic', () => {
      const hasRole = vi.fn().mockImplementation(
        (role) => role === 'manager'
      )
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: 1,
          email: 'manager@example.com',
          tenant_id: 1,
          roles: ['manager'],
          permissions: []
        },
        hasRole,
        hasPermission: vi.fn()
      } as any)

      render(
        <MemoryRouter initialEntries={['/management']}>
          <Routes>
            <Route
              path="/management"
              element={
                <ProtectedRoute requireRole={['admin', 'manager']}>
                  <div>Management Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Management Content')).toBeInTheDocument()
      expect(hasRole).toHaveBeenCalledWith('admin')
      expect(hasRole).toHaveBeenCalledWith('manager')
    })
  })

  describe('Permission-based access control', () => {
    it('should render when user has required permission', () => {
      const hasPermission = vi.fn().mockReturnValue(true)
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: 1,
          email: 'user@example.com',
          tenant_id: 1,
          roles: ['user'],
          permissions: ['contracts:read']
        },
        hasRole: vi.fn(),
        hasPermission
      } as any)

      render(
        <MemoryRouter initialEntries={['/contracts']}>
          <Routes>
            <Route
              path="/contracts"
              element={
                <ProtectedRoute requirePermission="contracts:read">
                  <div>Contracts Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Contracts Content')).toBeInTheDocument()
      expect(hasPermission).toHaveBeenCalledWith('contracts:read')
    })

    it('should check multiple permissions with AND logic', () => {
      const hasPermission = vi.fn().mockReturnValue(true)
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: 1,
          email: 'user@example.com',
          tenant_id: 1,
          roles: ['user'],
          permissions: ['contracts:read', 'contracts:write']
        },
        hasRole: vi.fn(),
        hasPermission
      } as any)

      render(
        <MemoryRouter initialEntries={['/contracts/edit']}>
          <Routes>
            <Route
              path="/contracts/edit"
              element={
                <ProtectedRoute 
                  requirePermission={['contracts:read', 'contracts:write']}
                  requireAllPermissions={true}
                >
                  <div>Edit Contracts</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Edit Contracts')).toBeInTheDocument()
      expect(hasPermission).toHaveBeenCalledWith('contracts:read')
      expect(hasPermission).toHaveBeenCalledWith('contracts:write')
    })
  })

  describe('Loading states', () => {
    it('should show loading component while checking auth', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: true,
        hasRole: vi.fn(),
        hasPermission: vi.fn()
      } as any)

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })

    it('should use custom loading component when provided', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: true,
        hasRole: vi.fn(),
        hasPermission: vi.fn()
      } as any)

      const CustomLoader = () => <div>Custom Loading...</div>

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute loadingComponent={<CustomLoader />}>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Custom Loading...')).toBeInTheDocument()
    })
  })

  describe('Fallback components', () => {
    it('should render custom unauthorized component', () => {
      const hasRole = vi.fn().mockReturnValue(false)
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: 1,
          email: 'user@example.com',
          tenant_id: 1,
          roles: ['user'],
          permissions: []
        },
        hasRole,
        hasPermission: vi.fn()
      } as any)

      const CustomUnauthorized = () => <div>Access Denied!</div>

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route
              path="/admin"
              element={
                <ProtectedRoute 
                  requireRole="admin"
                  unauthorizedComponent={<CustomUnauthorized />}
                >
                  <div>Admin Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Access Denied!')).toBeInTheDocument()
      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
    })
  })

  describe('Tenant validation', () => {
    it('should validate tenant access when required', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: 1,
          email: 'user@example.com',
          tenant_id: 1,
          roles: ['user'],
          permissions: []
        },
        hasRole: vi.fn(),
        hasPermission: vi.fn()
      } as any)

      render(
        <MemoryRouter initialEntries={['/tenant/2/dashboard']}>
          <Routes>
            <Route
              path="/tenant/:tenantId/dashboard"
              element={
                <ProtectedRoute validateTenant={true}>
                  <div>Dashboard Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      // User has tenant_id 1 but trying to access tenant 2
      expect(screen.getByText(/not authorized/i)).toBeInTheDocument()
      expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument()
    })

    it('should allow access to matching tenant', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: 1,
          email: 'user@example.com',
          tenant_id: 1,
          roles: ['user'],
          permissions: []
        },
        hasRole: vi.fn(),
        hasPermission: vi.fn()
      } as any)

      render(
        <MemoryRouter initialEntries={['/tenant/1/dashboard']}>
          <Routes>
            <Route
              path="/tenant/:tenantId/dashboard"
              element={
                <ProtectedRoute validateTenant={true}>
                  <div>Dashboard Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Dashboard Content')).toBeInTheDocument()
    })

    it('should allow superuser to access any tenant', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: 1,
          email: 'admin@example.com',
          tenant_id: 1,
          is_superuser: true,
          roles: ['admin'],
          permissions: []
        },
        hasRole: vi.fn(),
        hasPermission: vi.fn()
      } as any)

      render(
        <MemoryRouter initialEntries={['/tenant/999/dashboard']}>
          <Routes>
            <Route
              path="/tenant/:tenantId/dashboard"
              element={
                <ProtectedRoute validateTenant={true}>
                  <div>Dashboard Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Dashboard Content')).toBeInTheDocument()
    })
  })
})