/**
 * Tests for Auth Store
 * Following TDD - Red phase: Write failing tests first
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuthStore } from './auth'
import * as authService from '@/services/auth'

// Mock the auth service
vi.mock('@/services/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
  getCurrentUser: vi.fn(),
  register: vi.fn(),
}))

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useAuthStore())
    act(() => {
      result.current.reset()
    })
    
    // Clear all mocks
    vi.clearAllMocks()
    
    // Clear localStorage
    localStorage.clear()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAuthStore())
      
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.token).toBeNull()
      expect(result.current.refreshToken).toBeNull()
    })
  })

  describe('Login', () => {
    it('should login successfully', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        full_name: 'Test User',
        tenant_id: 1,
      }
      
      const mockResponse = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user: mockUser,
      }
      
      vi.mocked(authService.login).mockResolvedValue(mockResponse)
      
      const { result } = renderHook(() => useAuthStore())
      
      await act(async () => {
        await result.current.login('test@example.com', 'password')
      })
      
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.token).toBe('access-token')
      expect(result.current.refreshToken).toBe('refresh-token')
      expect(result.current.error).toBeNull()
      
      // Check localStorage
      expect(localStorage.getItem('auth-token')).toBe('access-token')
      expect(localStorage.getItem('refresh-token')).toBe('refresh-token')
    })

    it('should handle login error', async () => {
      const mockError = new Error('Invalid credentials')
      vi.mocked(authService.login).mockRejectedValue(mockError)
      
      const { result } = renderHook(() => useAuthStore())
      
      await act(async () => {
        await result.current.login('test@example.com', 'wrong-password')
      })
      
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.error).toBe('Invalid credentials')
      expect(localStorage.getItem('auth-token')).toBeNull()
    })

    it('should set loading state during login', async () => {
      vi.mocked(authService.login).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )
      
      const { result } = renderHook(() => useAuthStore())
      
      const loginPromise = act(async () => {
        await result.current.login('test@example.com', 'password')
      })
      
      expect(result.current.isLoading).toBe(true)
      
      await loginPromise
      
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('Logout', () => {
    it('should logout successfully', async () => {
      vi.mocked(authService.logout).mockResolvedValue(undefined)
      
      const { result } = renderHook(() => useAuthStore())
      
      // Set authenticated state first
      act(() => {
        result.current.setAuth({
          user: { id: 1, email: 'test@example.com' },
          token: 'access-token',
          refreshToken: 'refresh-token',
        })
      })
      
      expect(result.current.isAuthenticated).toBe(true)
      
      await act(async () => {
        await result.current.logout()
      })
      
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.token).toBeNull()
      expect(result.current.refreshToken).toBeNull()
      
      // Check localStorage is cleared
      expect(localStorage.getItem('auth-token')).toBeNull()
      expect(localStorage.getItem('refresh-token')).toBeNull()
    })

    it('should handle logout error gracefully', async () => {
      vi.mocked(authService.logout).mockRejectedValue(new Error('Logout failed'))
      
      const { result } = renderHook(() => useAuthStore())
      
      // Set authenticated state first
      act(() => {
        result.current.setAuth({
          user: { id: 1, email: 'test@example.com' },
          token: 'access-token',
          refreshToken: 'refresh-token',
        })
      })
      
      await act(async () => {
        await result.current.logout()
      })
      
      // Should still clear local state even if API call fails
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('Register', () => {
    it('should register successfully', async () => {
      const mockUser = {
        id: 1,
        email: 'new@example.com',
        full_name: 'New User',
        tenant_id: 1,
      }
      
      const mockResponse = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user: mockUser,
      }
      
      vi.mocked(authService.register).mockResolvedValue(mockResponse)
      
      const { result } = renderHook(() => useAuthStore())
      
      await act(async () => {
        await result.current.register({
          email: 'new@example.com',
          password: 'password',
          full_name: 'New User',
        })
      })
      
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('should handle registration error', async () => {
      const mockError = new Error('Email already exists')
      vi.mocked(authService.register).mockRejectedValue(mockError)
      
      const { result } = renderHook(() => useAuthStore())
      
      await act(async () => {
        await result.current.register({
          email: 'existing@example.com',
          password: 'password',
          full_name: 'User',
        })
      })
      
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.error).toBe('Email already exists')
    })
  })

  describe('Token Refresh', () => {
    it('should refresh token successfully', async () => {
      const mockResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      }
      
      vi.mocked(authService.refreshToken).mockResolvedValue(mockResponse)
      
      const { result } = renderHook(() => useAuthStore())
      
      // Set initial tokens
      act(() => {
        result.current.setAuth({
          user: { id: 1, email: 'test@example.com' },
          token: 'old-access-token',
          refreshToken: 'old-refresh-token',
        })
      })
      
      await act(async () => {
        await result.current.refreshAccessToken()
      })
      
      expect(result.current.token).toBe('new-access-token')
      expect(result.current.refreshToken).toBe('new-refresh-token')
      expect(localStorage.getItem('auth-token')).toBe('new-access-token')
    })

    it('should logout if token refresh fails', async () => {
      vi.mocked(authService.refreshToken).mockRejectedValue(new Error('Invalid refresh token'))
      
      const { result } = renderHook(() => useAuthStore())
      
      // Set authenticated state
      act(() => {
        result.current.setAuth({
          user: { id: 1, email: 'test@example.com' },
          token: 'access-token',
          refreshToken: 'invalid-refresh-token',
        })
      })
      
      await act(async () => {
        await result.current.refreshAccessToken()
      })
      
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.token).toBeNull()
    })
  })

  describe('Load User', () => {
    it('should load current user successfully', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        full_name: 'Test User',
        tenant_id: 1,
      }
      
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser)
      
      const { result } = renderHook(() => useAuthStore())
      
      // Set token first
      act(() => {
        result.current.setAuth({
          token: 'access-token',
          refreshToken: 'refresh-token',
        })
      })
      
      await act(async () => {
        await result.current.loadUser()
      })
      
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('should handle load user error', async () => {
      vi.mocked(authService.getCurrentUser).mockRejectedValue(new Error('Unauthorized'))
      
      const { result } = renderHook(() => useAuthStore())
      
      // Set token first
      act(() => {
        result.current.setAuth({
          token: 'invalid-token',
          refreshToken: 'refresh-token',
        })
      })
      
      await act(async () => {
        await result.current.loadUser()
      })
      
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('Initialization', () => {
    it('should initialize from localStorage', async () => {
      localStorage.setItem('auth-token', 'stored-token')
      localStorage.setItem('refresh-token', 'stored-refresh-token')
      
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        full_name: 'Test User',
        tenant_id: 1,
      }
      
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser)
      
      const { result } = renderHook(() => useAuthStore())
      
      await act(async () => {
        await result.current.initialize()
      })
      
      expect(result.current.token).toBe('stored-token')
      expect(result.current.refreshToken).toBe('stored-refresh-token')
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('should not initialize if no stored tokens', async () => {
      const { result } = renderHook(() => useAuthStore())
      
      await act(async () => {
        await result.current.initialize()
      })
      
      expect(result.current.token).toBeNull()
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('Permissions', () => {
    it('should check user permissions', () => {
      const { result } = renderHook(() => useAuthStore())
      
      act(() => {
        result.current.setAuth({
          user: {
            id: 1,
            email: 'test@example.com',
            roles: ['admin', 'manager'],
            permissions: ['contract.read', 'contract.write'],
          },
          token: 'token',
        })
      })
      
      expect(result.current.hasRole('admin')).toBe(true)
      expect(result.current.hasRole('viewer')).toBe(false)
      expect(result.current.hasPermission('contract.read')).toBe(true)
      expect(result.current.hasPermission('contract.delete')).toBe(false)
    })
  })
})