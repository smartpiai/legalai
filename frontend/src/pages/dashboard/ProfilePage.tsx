/**
 * ProfilePage Component
 * User profile management with comprehensive settings
 * Following TDD methodology - Final optimized implementation
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Input, Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui'
import { useAuthStore } from '@/store/auth'
import {
  profileUpdateSchema,
  preferencesSchema,
  securitySettingsSchema,
  changePasswordSchema,
  passwordConfirmationSchema,
  themeOptions,
  languageOptions,
  timezoneOptions,
  type ProfileUpdateFormData,
  type PreferencesFormData,
  type SecuritySettingsFormData,
  type ChangePasswordFormData,
  type PasswordConfirmationFormData,
} from '@/schemas/auth.schema'
import * as authService from '@/services/auth'
import { User, Edit2, Save, X, Camera, Shield, Settings, Trash2, Download, LogOut } from 'lucide-react'

interface ProfilePageProps {}

interface AlertProps {
  type: 'success' | 'error' | 'warning'
  message: string
  onClose: () => void
}

interface FormSectionProps {
  title: string
  children: React.ReactNode
  className?: string
}

const Alert: React.FC<AlertProps> = ({ type, message, onClose }) => {
  const bgColor = type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                   type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                   'bg-yellow-50 border-yellow-200 text-yellow-800'

  return (
    <div className={`rounded-md border p-4 ${bgColor} mb-4`}>
      <div className="flex justify-between items-start">
        <p className="text-sm">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Close alert"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

const FormSection: React.FC<FormSectionProps> = ({ title, children, className = '' }) => (
  <Card className={className}>
    <CardHeader>
      <CardTitle as="h2">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      {children}
    </CardContent>
  </Card>
)

const ProfilePage: React.FC<ProfilePageProps> = () => {
  const { user, isLoading: authLoading, setAuth } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [preferences, setPreferences] = useState<PreferencesFormData>({
    theme: 'system',
    language: 'en',
    timezone: 'UTC',
    emailNotifications: true,
    browserNotifications: true,
    contractUpdates: true,
    marketingEmails: false,
  })
  const [securitySettings, setSecuritySettings] = useState<SecuritySettingsFormData>({
    twoFactorEnabled: false,
    sessionTimeout: 60,
  })

  // Main profile form
  const profileForm = useForm<ProfileUpdateFormData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      department: '',
      title: '',
      organization: '',
    },
  })

  // Password change form
  const passwordForm = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  })

  // Password confirmation form
  const confirmForm = useForm<PasswordConfirmationFormData>({
    resolver: zodResolver(passwordConfirmationSchema),
  })

  // Helper function to parse user data
  const parseUserData = useCallback((userData: typeof user) => {
    if (!userData) return null
    
    const nameParts = (userData.full_name || '').split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    
    return {
      firstName,
      lastName,
      email: userData.email,
      phone: (userData as any).phone || '',
      department: (userData as any).department || '',
      title: (userData as any).title || '',
      organization: (userData as any).organization || '',
    }
  }, [])

  // Load user data into form
  useEffect(() => {
    const userData = parseUserData(user)
    if (userData) {
      profileForm.reset(userData)
    }
  }, [user, parseUserData, profileForm])

  const handleEditToggle = useCallback(() => {
    if (isEditing) {
      // Cancel editing - reset form
      const userData = parseUserData(user)
      if (userData) {
        profileForm.reset(userData)
      }
      setIsEditing(false)
    } else {
      setIsEditing(true)
    }
  }, [isEditing, parseUserData, user, profileForm])

  const handleProfileSave = useCallback(async (data: ProfileUpdateFormData) => {
    setIsLoading(true)
    try {
      const updatedUser = await authService.updateProfile({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        department: data.department,
        title: data.title,
        organization: data.organization,
      })

      setAuth({ user: updatedUser })
      setIsEditing(false)
      setAlert({ type: 'success', message: 'Profile updated successfully' })
    } catch (error: any) {
      setAlert({ type: 'error', message: error.message || 'Failed to update profile' })
    } finally {
      setIsLoading(false)
    }
  }, [setAuth])

  const handlePasswordChange = useCallback(async (data: ChangePasswordFormData) => {
    setIsLoading(true)
    try {
      await authService.changePassword(data.currentPassword, data.newPassword)
      passwordForm.reset()
      setAlert({ type: 'success', message: 'Password changed successfully' })
    } catch (error: any) {
      setAlert({ type: 'error', message: error.message || 'Failed to change password' })
    } finally {
      setIsLoading(false)
    }
  }, [passwordForm])

  const handleTwoFactorToggle = async () => {
    setIsLoading(true)
    try {
      if (securitySettings.twoFactorEnabled) {
        // Show password confirmation for disabling 2FA
        setShowPasswordConfirm(true)
      } else {
        // Enable 2FA
        await authService.enableTwoFactor()
        setSecuritySettings(prev => ({ ...prev, twoFactorEnabled: true }))
        setAlert({ type: 'success', message: 'Two-factor authentication enabled' })
      }
    } catch (error: any) {
      setAlert({ type: 'error', message: error.message || 'Failed to toggle two-factor authentication' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogoutAllDevices = async () => {
    setIsLoading(true)
    try {
      await authService.logoutAllDevices()
      setAlert({ type: 'success', message: 'Logged out from all devices' })
    } catch (error: any) {
      setAlert({ type: 'error', message: error.message || 'Failed to logout from all devices' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadData = async () => {
    setIsLoading(true)
    try {
      const blob = await authService.downloadUserData()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = 'user-data.json'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      setAlert({ type: 'success', message: 'User data downloaded successfully' })
    } catch (error: any) {
      setAlert({ type: 'error', message: error.message || 'Failed to download user data' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    setShowDeleteConfirm(true)
  }

  const confirmDeleteAccount = async (data: PasswordConfirmationFormData) => {
    setIsLoading(true)
    try {
      await authService.deleteAccount(data.currentPassword)
      // Logout and redirect will be handled by auth guard
    } catch (error: any) {
      setAlert({ type: 'error', message: error.message || 'Failed to delete account' })
    } finally {
      setIsLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4" data-testid="profile-container">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
          <Button
            onClick={handleEditToggle}
            variant={isEditing ? 'secondary' : 'primary'}
            icon={isEditing ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
            disabled={isLoading}
          >
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </Button>
        </div>

        {/* Alert */}
        {alert && (
          <Alert
            type={alert.type}
            message={alert.message}
            onClose={() => setAlert(null)}
          />
        )}

        {/* Personal Information */}
        <FormSection title="Personal Information">
            <form onSubmit={profileForm.handleSubmit(handleProfileSave)} className="space-y-4">
              <div className="flex items-center space-x-4 mb-6">
                <div className="relative">
                  <img
                    src={user.avatar_url || '/default-avatar.png'}
                    alt="Profile picture"
                    className="h-16 w-16 rounded-full object-cover"
                  />
                  {isEditing && (
                    <button
                      type="button"
                      className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white hover:bg-opacity-60"
                      aria-label="Change picture"
                    >
                      <Camera className="h-5 w-5" />
                      <span className="sr-only">Change picture</span>
                    </button>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-medium">{user.full_name || 'No name'}</h3>
                  <p className="text-gray-500">{user.email}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  {...profileForm.register('firstName')}
                  error={profileForm.formState.errors.firstName?.message}
                  readOnly={!isEditing}
                  disabled={isLoading}
                  required
                />
                <Input
                  label="Last Name"
                  {...profileForm.register('lastName')}
                  error={profileForm.formState.errors.lastName?.message}
                  readOnly={!isEditing}
                  disabled={isLoading}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  {...profileForm.register('email')}
                  error={profileForm.formState.errors.email?.message}
                  readOnly={!isEditing}
                  disabled={isLoading}
                  required
                />
                <Input
                  label="Phone"
                  type="tel"
                  {...profileForm.register('phone')}
                  error={profileForm.formState.errors.phone?.message}
                  readOnly={!isEditing}
                  disabled={isLoading}
                />
              </div>

              {isEditing && profileForm.watch('email') !== user.email && (
                <div className="text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 rounded p-3">
                  Changing your email will require verification
                </div>
              )}
            </form>
            {isEditing && (
              <div className="pt-6 border-t">
                <Button
                  onClick={profileForm.handleSubmit(handleProfileSave)}
                  loading={isLoading}
                  disabled={!profileForm.formState.isValid}
                >
                  Save Changes
                </Button>
              </div>
            )}
        </FormSection>

        {/* Work Information */}
        <FormSection title="Work Information">
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Department"
              {...profileForm.register('department')}
              error={profileForm.formState.errors.department?.message}
              readOnly={!isEditing}
              disabled={isLoading}
            />
            <Input
              label="Title"
              {...profileForm.register('title')}
              error={profileForm.formState.errors.title?.message}
              readOnly={!isEditing}
              disabled={isLoading}
            />
            <Input
              label="Organization"
              {...profileForm.register('organization')}
              error={profileForm.formState.errors.organization?.message}
              readOnly={!isEditing}
              disabled={isLoading}
              containerClassName="md:col-span-2"
            />
          </div>
        </FormSection>

        {/* Security Settings */}
        <FormSection title="Security Settings">
          <div className="space-y-6">
            {/* Password Change */}
            <div>
              <h4 className="font-medium mb-4">Change Password</h4>
              <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4">
                <Input
                  label="Current Password"
                  type="password"
                  {...passwordForm.register('currentPassword')}
                  error={passwordForm.formState.errors.currentPassword?.message}
                />
                <Input
                  label="New Password"
                  type="password"
                  {...passwordForm.register('newPassword')}
                  error={passwordForm.formState.errors.newPassword?.message}
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  {...passwordForm.register('confirmPassword')}
                  error={passwordForm.formState.errors.confirmPassword?.message}
                />
                <Button
                  type="submit"
                  loading={isLoading}
                  disabled={!passwordForm.formState.isValid}
                >
                  Change Password
                </Button>
              </form>
            </div>

            {/* Two-Factor Authentication */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Two-Factor Authentication</h4>
                  <p className="text-sm text-gray-500">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={securitySettings.twoFactorEnabled}
                    onChange={handleTwoFactorToggle}
                    disabled={isLoading}
                    className="sr-only"
                  />
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    securitySettings.twoFactorEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}>
                    <div className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      securitySettings.twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </div>
                  <span className="ml-3 text-sm">
                    Enable two-factor authentication
                  </span>
                </label>
              </div>
            </div>
          </div>
        </FormSection>

        {/* Preferences */}
        <FormSection title="Preferences">
          <div className="space-y-6">
            {/* Theme Preference */}
            <div>
              <h4 className="font-medium mb-3">Theme Preference</h4>
              <div className="flex space-x-4">
                {themeOptions.map((option) => (
                  <label key={option.value} className="flex items-center">
                    <input
                      type="radio"
                      name="theme"
                      value={option.value}
                      checked={preferences.theme === option.value}
                      onChange={(e) => setPreferences(prev => ({ ...prev, theme: e.target.value as any }))}
                      className="mr-2"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Language */}
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
                Language
              </label>
              <select
                id="language"
                value={preferences.language}
                onChange={(e) => setPreferences(prev => ({ ...prev, language: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm"
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Timezone */}
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
                Timezone
              </label>
              <select
                id="timezone"
                value={preferences.timezone}
                onChange={(e) => setPreferences(prev => ({ ...prev, timezone: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm"
              >
                {timezoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notification Preferences */}
            <div>
              <h4 className="font-medium mb-3">Notification Preferences</h4>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.emailNotifications}
                    onChange={(e) => setPreferences(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                    className="mr-3"
                  />
                  Email notifications
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.browserNotifications}
                    onChange={(e) => setPreferences(prev => ({ ...prev, browserNotifications: e.target.checked }))}
                    className="mr-3"
                  />
                  Browser notifications
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.contractUpdates}
                    onChange={(e) => setPreferences(prev => ({ ...prev, contractUpdates: e.target.checked }))}
                    className="mr-3"
                  />
                  Contract updates
                </label>
              </div>
            </div>
          </div>
        </FormSection>

        {/* Account Actions */}
        <FormSection title="Account Actions">
          <div className="space-y-4">
            <Button
              onClick={handleLogoutAllDevices}
              variant="secondary"
              icon={<LogOut className="h-4 w-4" />}
              loading={isLoading}
              fullWidth
            >
              Logout All Devices
            </Button>
            <Button
              onClick={handleDownloadData}
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              loading={isLoading}
              fullWidth
            >
              Download Data
            </Button>
            <Button
              onClick={handleDeleteAccount}
              variant="danger"
              icon={<Trash2 className="h-4 w-4" />}
              loading={isLoading}
              fullWidth
            >
              Delete Account
            </Button>
          </div>
        </FormSection>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle>Delete Account</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Are you sure you want to delete your account? This action cannot be undone.
                </p>
                <form onSubmit={confirmForm.handleSubmit(confirmDeleteAccount)}>
                  <Input
                    label="Current Password"
                    type="password"
                    {...confirmForm.register('currentPassword')}
                    error={confirmForm.formState.errors.currentPassword?.message}
                    required
                  />
                </form>
              </CardContent>
              <CardFooter className="space-x-2">
                <Button
                  onClick={() => setShowDeleteConfirm(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmForm.handleSubmit(confirmDeleteAccount)}
                  variant="danger"
                  loading={isLoading}
                >
                  Confirm Delete
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* Password Confirmation Modal */}
        {showPasswordConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle>Confirm Password</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Please enter your current password to confirm this change.
                </p>
                <Input
                  label="Current Password"
                  type="password"
                  {...confirmForm.register('currentPassword')}
                  error={confirmForm.formState.errors.currentPassword?.message}
                  required
                />
              </CardContent>
              <CardFooter className="space-x-2">
                <Button
                  onClick={() => setShowPasswordConfirm(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmForm.handleSubmit(() => setShowPasswordConfirm(false))}
                  loading={isLoading}
                >
                  Confirm
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProfilePage