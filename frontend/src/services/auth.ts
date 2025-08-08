/**
 * Authentication Service
 * Handles API calls for authentication
 */
import { apiClient } from './apiClient'

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: {
    id: number
    email: string
    full_name?: string
    tenant_id: number
    is_active?: boolean
    is_superuser?: boolean
    roles?: string[]
    permissions?: string[]
  }
}

export interface RegisterData {
  email: string
  password: string
  full_name?: string
  company_name?: string
}

export interface RefreshTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

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

/**
 * Login with email and password
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login', {
    username: email, // API expects username field
    password,
  })
  return response.data
}

/**
 * Register a new user
 */
export async function register(data: RegisterData): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/register', data)
  return response.data
}

/**
 * Logout the current user
 */
export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout')
}

/**
 * Refresh access token using refresh token
 */
export async function refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
  const response = await apiClient.post<RefreshTokenResponse>('/auth/refresh', {
    refresh_token: refreshToken,
  })
  return response.data
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<User> {
  const response = await apiClient.get<User>('/auth/me')
  return response.data
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiClient.post('/auth/password-reset/request', { email })
}

/**
 * Reset password with token
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/password-reset/confirm', {
    token,
    new_password: newPassword,
  })
}

/**
 * Change password for authenticated user
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}

/**
 * Verify email with token
 */
export async function verifyEmail(token: string): Promise<void> {
  await apiClient.post('/auth/verify-email', { token })
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(): Promise<void> {
  await apiClient.post('/auth/resend-verification')
}