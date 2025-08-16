/**
 * Authentication Store using Zustand
 * Manages authentication state for the Legal AI Platform
 */
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import * as authService from '@/services/auth'

export interface User {
  id: number
  email: string
  full_name?: string
  tenant_id: number
  is_active?: boolean
  is_superuser?: boolean
  roles?: string[]
  permissions?: string[]
  avatar_url?: string
}

interface AuthState {
  // State
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  
  // Actions
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (data: RegisterData) => Promise<boolean>
  refreshAccessToken: () => Promise<void>
  loadUser: () => Promise<void>
  initialize: () => Promise<void>
  setAuth: (data: Partial<AuthData>) => void
  setError: (error: string | null) => void
  setLoading: (loading: boolean) => void
  reset: () => void
  
  // Permission helpers
  hasRole: (role: string) => boolean
  hasPermission: (permission: string) => boolean
  hasAnyRole: (roles: string[]) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
}

interface AuthData {
  user?: User | null
  token?: string | null
  refreshToken?: string | null
}

interface RegisterData {
  username: string
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword?: string
  organization?: string
  department?: string
  phone?: string
}

const initialState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        
        login: async (email: string, password: string) => {
          set({ isLoading: true, error: null })
          
          try {
            const response = await authService.login(email, password)
            
            const { access_token, refresh_token, user } = response
            
            // Store tokens in localStorage
            localStorage.setItem('auth-token', access_token)
            localStorage.setItem('refresh-token', refresh_token)
            
            set({
              user,
              token: access_token,
              refreshToken: refresh_token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            })
          } catch (error: any) {
            set({
              isLoading: false,
              error: error.message || 'Login failed',
            })
            throw error
          }
        },
        
        logout: async () => {
          set({ isLoading: true })
          
          try {
            await authService.logout()
          } catch (error) {
            // Continue with logout even if API call fails
            console.error('Logout API error:', error)
          } finally {
            // Clear tokens from localStorage
            localStorage.removeItem('auth-token')
            localStorage.removeItem('refresh-token')
            
            // Reset state
            set(initialState)
          }
        },
        
        register: async (data: RegisterData) => {
          set({ isLoading: true, error: null })
          
          try {
            // Transform data to match API expectations
            const apiData = {
              username: data.username,
              email: data.email,
              password: data.password,
              confirm_password: data.confirmPassword,
              full_name: `${data.firstName} ${data.lastName}`,
              company_name: data.organization || undefined,
            }
            
            await authService.register(apiData)
            
            set({ isLoading: false })
            return true
          } catch (error: any) {
            set({
              isLoading: false,
              error: error.message || 'Registration failed',
            })
            return false
          }
        },
        
        refreshAccessToken: async () => {
          const { refreshToken } = get()
          
          if (!refreshToken) {
            await get().logout()
            return
          }
          
          try {
            const response = await authService.refreshToken(refreshToken)
            
            const { access_token, refresh_token } = response
            
            // Update tokens in localStorage
            localStorage.setItem('auth-token', access_token)
            localStorage.setItem('refresh-token', refresh_token)
            
            set({
              token: access_token,
              refreshToken: refresh_token,
            })
          } catch (error) {
            // If refresh fails, logout user
            await get().logout()
            throw error
          }
        },
        
        loadUser: async () => {
          const { token } = get()
          
          if (!token) {
            set({ isAuthenticated: false })
            return
          }
          
          set({ isLoading: true })
          
          try {
            const user = await authService.getCurrentUser()
            
            set({
              user,
              isAuthenticated: true,
              isLoading: false,
            })
          } catch (error) {
            // If loading user fails, clear auth
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            })
            throw error
          }
        },
        
        initialize: async () => {
          // Load tokens from localStorage
          const token = localStorage.getItem('auth-token')
          const refreshToken = localStorage.getItem('refresh-token')
          
          if (token && refreshToken) {
            set({ token, refreshToken })
            
            try {
              await get().loadUser()
            } catch (error) {
              // If loading user fails, try to refresh token
              try {
                await get().refreshAccessToken()
                await get().loadUser()
              } catch (refreshError) {
                // If refresh also fails, clear auth
                await get().logout()
              }
            }
          }
        },
        
        setAuth: (data: Partial<AuthData>) => {
          const updates: Partial<AuthState> = {}
          
          if (data.user !== undefined) updates.user = data.user
          if (data.token !== undefined) updates.token = data.token
          if (data.refreshToken !== undefined) updates.refreshToken = data.refreshToken
          
          // Update authentication status
          updates.isAuthenticated = !!(data.user || get().user) && !!(data.token || get().token)
          
          // Store tokens in localStorage if provided
          if (data.token) localStorage.setItem('auth-token', data.token)
          if (data.refreshToken) localStorage.setItem('refresh-token', data.refreshToken)
          
          set(updates)
        },
        
        setError: (error: string | null) => set({ error }),
        
        setLoading: (isLoading: boolean) => set({ isLoading }),
        
        reset: () => {
          localStorage.removeItem('auth-token')
          localStorage.removeItem('refresh-token')
          set(initialState)
        },
        
        hasRole: (role: string) => {
          const { user } = get()
          return user?.roles?.includes(role) || false
        },
        
        hasPermission: (permission: string) => {
          const { user } = get()
          return user?.permissions?.includes(permission) || false
        },
        
        hasAnyRole: (roles: string[]) => {
          const { user } = get()
          return roles.some(role => user?.roles?.includes(role)) || false
        },
        
        hasAnyPermission: (permissions: string[]) => {
          const { user } = get()
          return permissions.some(permission => user?.permissions?.includes(permission)) || false
        },
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          // Don't persist sensitive data in zustand storage
          // We use localStorage directly for tokens
        }),
      }
    )
  )
)
