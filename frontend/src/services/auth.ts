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

/**
 * Profile update data interface
 */
export interface ProfileUpdateData {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  department?: string
  title?: string
  organization?: string
}

/**
 * User preferences interface
 */
export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system'
  language?: string
  timezone?: string
  emailNotifications?: boolean
  browserNotifications?: boolean
  contractUpdates?: boolean
  marketingEmails?: boolean
}

/**
 * Security settings interface
 */
export interface SecuritySettings {
  twoFactorEnabled?: boolean
  sessionTimeout?: number
}

/**
 * Update user profile information
 */
export async function updateProfile(data: ProfileUpdateData): Promise<User> {
  const updateData = {
    full_name: data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : undefined,
    email: data.email,
    phone: data.phone,
    department: data.department,
    title: data.title,
    organization: data.organization,
  }

  // Remove undefined values
  const cleanData = Object.fromEntries(
    Object.entries(updateData).filter(([_, value]) => value !== undefined)
  )

  const response = await apiClient.patch<User>('/auth/profile', cleanData)
  return response.data
}

/**
 * Update user preferences
 */
export async function updatePreferences(preferences: UserPreferences): Promise<UserPreferences> {
  const response = await apiClient.patch<UserPreferences>('/auth/preferences', preferences)
  return response.data
}

/**
 * Update security settings
 */
export async function updateSecuritySettings(settings: SecuritySettings): Promise<SecuritySettings> {
  const response = await apiClient.patch<SecuritySettings>('/auth/security', settings)
  return response.data
}

/**
 * Upload profile picture
 */
export async function uploadProfilePicture(file: File): Promise<{ avatar_url: string }> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<{ avatar_url: string }>('/auth/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  
  return response.data
}

/**
 * Enable two-factor authentication
 */
export async function enableTwoFactor(): Promise<{ qr_code: string; backup_codes: string[] }> {
  const response = await apiClient.post<{ qr_code: string; backup_codes: string[] }>('/auth/2fa/enable')
  return response.data
}

/**
 * Disable two-factor authentication
 */
export async function disableTwoFactor(currentPassword: string): Promise<void> {
  await apiClient.post('/auth/2fa/disable', {
    current_password: currentPassword,
  })
}

/**
 * Verify two-factor authentication setup
 */
export async function verifyTwoFactor(token: string): Promise<void> {
  await apiClient.post('/auth/2fa/verify', {
    token,
  })
}

/**
 * Get user preferences
 */
export async function getUserPreferences(): Promise<UserPreferences> {
  const response = await apiClient.get<UserPreferences>('/auth/preferences')
  return response.data
}

/**
 * Get security settings
 */
export async function getSecuritySettings(): Promise<SecuritySettings> {
  const response = await apiClient.get<SecuritySettings>('/auth/security')
  return response.data
}

/**
 * Logout from all devices
 */
export async function logoutAllDevices(): Promise<void> {
  await apiClient.post('/auth/logout-all')
}

/**
 * Download user data (GDPR compliance)
 */
export async function downloadUserData(): Promise<Blob> {
  const response = await apiClient.get('/auth/data-export', {
    responseType: 'blob',
  })
  return response.data
}

/**
 * Delete user account
 */
export async function deleteAccount(currentPassword: string): Promise<void> {
  await apiClient.delete('/auth/account', {
    data: { current_password: currentPassword },
  })
}

/**
 * Confirm sensitive changes with password
 */
export async function confirmWithPassword(currentPassword: string): Promise<boolean> {
  try {
    await apiClient.post('/auth/confirm-password', {
      current_password: currentPassword,
    })
    return true
  } catch {
    return false
  }
}