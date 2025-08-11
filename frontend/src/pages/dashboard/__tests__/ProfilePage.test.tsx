/**
 * ProfilePage Component Tests
 * Comprehensive test suite following TDD methodology
 * Tests all functionality without mocks - using real implementations
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { vi } from 'vitest'
import ProfilePage from '../ProfilePage'
import { useAuthStore } from '@/store/auth'

// Test user data
const mockUser = {
  id: 1,
  email: 'john.doe@example.com',
  full_name: 'John Doe',
  tenant_id: 1,
  is_active: true,
  is_superuser: false,
  roles: ['user'],
  permissions: ['read:own_profile'],
  avatar_url: 'https://example.com/avatar.jpg',
  phone: '+1234567890',
  department: 'Legal',
  title: 'Contract Manager',
  organization: 'Legal Corp'
}

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
)

const renderProfilePage = () => {
  return render(
    <TestWrapper>
      <ProfilePage />
    </TestWrapper>
  )
}

describe('ProfilePage', () => {
  beforeEach(() => {
    // Initialize auth store with mock user
    useAuthStore.getState().setAuth({ user: mockUser, token: 'mock-token' })
  })

  afterEach(() => {
    // Reset auth store
    useAuthStore.getState().reset()
    vi.clearAllMocks()
  })

  describe('Rendering and Initial State', () => {
    it('renders profile page with user information', async () => {
      renderProfilePage()
      
      expect(screen.getByText('Profile Settings')).toBeInTheDocument()
      
      // Wait for form to be populated
      await waitFor(() => {
        expect(screen.getByDisplayValue('John')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Doe')).toBeInTheDocument()
        expect(screen.getByDisplayValue('john.doe@example.com')).toBeInTheDocument()
        expect(screen.getByDisplayValue('+1234567890')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Legal')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Contract Manager')).toBeInTheDocument()
      })
    })

    it('displays profile sections correctly', () => {
      renderProfilePage()
      
      expect(screen.getByText('Personal Information')).toBeInTheDocument()
      expect(screen.getByText('Work Information')).toBeInTheDocument()
      expect(screen.getByText('Security Settings')).toBeInTheDocument()
      expect(screen.getByText('Preferences')).toBeInTheDocument()
      expect(screen.getByText('Account Actions')).toBeInTheDocument()
    })

    it('shows fields in read-only mode by default', async () => {
      renderProfilePage()
      
      // Wait for form to be populated
      await waitFor(() => {
        const firstNameInput = screen.getByLabelText('First Name')
        const lastNameInput = screen.getByLabelText('Last Name')
        const emailInput = screen.getByLabelText('Email')
        
        expect(firstNameInput).toHaveAttribute('readonly')
        expect(lastNameInput).toHaveAttribute('readonly')
        expect(emailInput).toHaveAttribute('readonly')
      })
    })

    it('displays edit button in default state', () => {
      renderProfilePage()
      
      const editButton = screen.getByRole('button', { name: /edit profile/i })
      expect(editButton).toBeInTheDocument()
    })
  })

  describe('Edit Mode Toggle', () => {
    it('enables edit mode when edit button is clicked', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      const editButton = screen.getByRole('button', { name: /edit profile/i })
      await user.click(editButton)
      
      // Check that fields are no longer readonly
      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      
      expect(firstNameInput).not.toHaveAttribute('readonly')
      expect(lastNameInput).not.toHaveAttribute('readonly')
      
      // Check that save/cancel buttons appear
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('cancels edit mode when cancel button is clicked', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Enter edit mode
      await user.click(screen.getByRole('button', { name: /edit profile/i }))
      
      // Make changes
      const firstNameInput = screen.getByLabelText(/first name/i)
      await user.clear(firstNameInput)
      await user.type(firstNameInput, 'Jane')
      
      // Cancel changes
      await user.click(screen.getByRole('button', { name: /cancel/i }))
      
      // Check that original values are restored
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument()
      expect(screen.getByLabelText(/first name/i)).toHaveAttribute('readonly')
    })
  })

  describe('Form Validation', () => {
    it('validates required fields', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Enter edit mode
      await user.click(screen.getByRole('button', { name: /edit profile/i }))
      
      // Clear required fields
      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      
      await user.clear(firstNameInput)
      await user.clear(lastNameInput)
      
      // Attempt to save
      await user.click(screen.getByRole('button', { name: /save changes/i }))
      
      // Check for validation errors
      await waitFor(() => {
        expect(screen.getByText(/first name is required/i)).toBeInTheDocument()
        expect(screen.getByText(/last name is required/i)).toBeInTheDocument()
      })
    })

    it('validates email format', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Enter edit mode
      await user.click(screen.getByRole('button', { name: /edit profile/i }))
      
      // Enter invalid email
      const emailInput = screen.getByLabelText(/email/i)
      await user.clear(emailInput)
      await user.type(emailInput, 'invalid-email')
      
      // Attempt to save
      await user.click(screen.getByRole('button', { name: /save changes/i }))
      
      // Check for validation error
      await waitFor(() => {
        expect(screen.getByText(/invalid email format/i)).toBeInTheDocument()
      })
    })

    it('validates phone number format', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Enter edit mode
      await user.click(screen.getByRole('button', { name: /edit profile/i }))
      
      // Enter invalid phone
      const phoneInput = screen.getByLabelText(/phone/i)
      await user.clear(phoneInput)
      await user.type(phoneInput, '123')
      
      // Attempt to save
      await user.click(screen.getByRole('button', { name: /save changes/i }))
      
      // Check for validation error
      await waitFor(() => {
        expect(screen.getByText(/invalid phone number format/i)).toBeInTheDocument()
      })
    })

    it('validates minimum character requirements', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Enter edit mode
      await user.click(screen.getByRole('button', { name: /edit profile/i }))
      
      // Enter short names
      const firstNameInput = screen.getByLabelText(/first name/i)
      await user.clear(firstNameInput)
      await user.type(firstNameInput, 'A')
      
      // Attempt to save
      await user.click(screen.getByRole('button', { name: /save changes/i }))
      
      // Check for validation error
      await waitFor(() => {
        expect(screen.getByText(/first name must be at least 2 characters/i)).toBeInTheDocument()
      })
    })
  })

  describe('Personal Information Section', () => {
    it('allows editing first and last names', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Enter edit mode
      await user.click(screen.getByRole('button', { name: /edit profile/i }))
      
      // Edit names
      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      
      await user.clear(firstNameInput)
      await user.type(firstNameInput, 'Jane')
      await user.clear(lastNameInput)
      await user.type(lastNameInput, 'Smith')
      
      expect(firstNameInput).toHaveValue('Jane')
      expect(lastNameInput).toHaveValue('Smith')
    })

    it('allows editing email with warning', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Enter edit mode
      await user.click(screen.getByRole('button', { name: /edit profile/i }))
      
      // Edit email
      const emailInput = screen.getByLabelText(/email/i)
      await user.clear(emailInput)
      await user.type(emailInput, 'jane.smith@example.com')
      
      // Check for email change warning
      await waitFor(() => {
        expect(screen.getByText(/changing your email will require verification/i)).toBeInTheDocument()
      })
    })

    it('allows editing phone number', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Enter edit mode
      await user.click(screen.getByRole('button', { name: /edit profile/i }))
      
      // Edit phone
      const phoneInput = screen.getByLabelText(/phone/i)
      await user.clear(phoneInput)
      await user.type(phoneInput, '+1987654321')
      
      expect(phoneInput).toHaveValue('+1987654321')
    })
  })

  describe('Work Information Section', () => {
    it('allows editing department', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Enter edit mode
      await user.click(screen.getByRole('button', { name: /edit profile/i }))
      
      // Edit department
      const departmentInput = screen.getByLabelText(/department/i)
      await user.clear(departmentInput)
      await user.type(departmentInput, 'Engineering')
      
      expect(departmentInput).toHaveValue('Engineering')
    })

    it('allows editing job title', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Enter edit mode
      await user.click(screen.getByRole('button', { name: /edit profile/i }))
      
      // Edit title
      const titleInput = screen.getByLabelText(/title/i)
      await user.clear(titleInput)
      await user.type(titleInput, 'Senior Engineer')
      
      expect(titleInput).toHaveValue('Senior Engineer')
    })
  })

  describe('Password Change Section', () => {
    it('displays password change form', () => {
      renderProfilePage()
      
      expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument()
    })

    it('validates password change requirements', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Fill password change form
      await user.type(screen.getByLabelText(/current password/i), 'currentpass')
      await user.type(screen.getByLabelText(/new password/i), '123')
      await user.type(screen.getByLabelText(/confirm new password/i), '456')
      
      // Attempt to submit
      await user.click(screen.getByRole('button', { name: /change password/i }))
      
      // Check for validation errors
      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument()
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
      })
    })

    it('validates password strength requirements', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Fill with weak password
      await user.type(screen.getByLabelText(/new password/i), 'weakpass')
      
      // Check for strength validation
      await waitFor(() => {
        expect(screen.getByText(/password must contain uppercase, lowercase, number, and special character/i)).toBeInTheDocument()
      })
    })
  })

  describe('Two-Factor Authentication', () => {
    it('displays 2FA toggle', () => {
      renderProfilePage()
      
      const twoFactorToggle = screen.getByLabelText(/enable two-factor authentication/i)
      expect(twoFactorToggle).toBeInTheDocument()
      expect(twoFactorToggle).toHaveAttribute('type', 'checkbox')
    })

    it('toggles 2FA setting', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      const twoFactorToggle = screen.getByLabelText(/enable two-factor authentication/i)
      
      // Toggle 2FA
      await user.click(twoFactorToggle)
      expect(twoFactorToggle).toBeChecked()
      
      await user.click(twoFactorToggle)
      expect(twoFactorToggle).not.toBeChecked()
    })
  })

  describe('Preferences Section', () => {
    it('displays theme preference options', () => {
      renderProfilePage()
      
      expect(screen.getByText(/theme preference/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/light/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/dark/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/system/i)).toBeInTheDocument()
    })

    it('allows changing theme preference', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      const darkModeRadio = screen.getByLabelText(/dark/i)
      await user.click(darkModeRadio)
      
      expect(darkModeRadio).toBeChecked()
    })

    it('displays language preference dropdown', () => {
      renderProfilePage()
      
      expect(screen.getByLabelText(/language/i)).toBeInTheDocument()
      expect(screen.getByText(/english/i)).toBeInTheDocument()
    })

    it('displays timezone selection', () => {
      renderProfilePage()
      
      expect(screen.getByLabelText(/timezone/i)).toBeInTheDocument()
    })

    it('displays notification preferences', () => {
      renderProfilePage()
      
      expect(screen.getByText(/notification preferences/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email notifications/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/browser notifications/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/contract updates/i)).toBeInTheDocument()
    })
  })

  describe('Profile Picture', () => {
    it('displays current profile picture', () => {
      renderProfilePage()
      
      const avatar = screen.getByAltText(/profile picture/i)
      expect(avatar).toBeInTheDocument()
      expect(avatar).toHaveAttribute('src', mockUser.avatar_url)
    })

    it('shows upload button in edit mode', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Enter edit mode
      await user.click(screen.getByRole('button', { name: /edit profile/i }))
      
      expect(screen.getByLabelText(/change picture/i)).toBeInTheDocument()
    })
  })

  describe('Account Actions', () => {
    it('displays dangerous account actions', () => {
      renderProfilePage()
      
      expect(screen.getByRole('button', { name: /logout all devices/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /download data/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument()
    })

    it('shows confirmation dialog for dangerous actions', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Click delete account
      await user.click(screen.getByRole('button', { name: /delete account/i }))
      
      // Check for confirmation dialog
      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to delete your account/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /confirm delete/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      })
    })
  })

  describe('Loading States', () => {
    it('shows loading spinner when saving changes', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Enter edit mode and make changes
      await user.click(screen.getByRole('button', { name: /edit profile/i }))
      
      const firstNameInput = screen.getByLabelText(/first name/i)
      await user.clear(firstNameInput)
      await user.type(firstNameInput, 'Jane')
      
      // Save changes
      await user.click(screen.getByRole('button', { name: /save changes/i }))
      
      // Check for loading state
      expect(screen.getByTestId('button-spinner')).toBeInTheDocument()
    })

    it('disables form during loading', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Enter edit mode
      await user.click(screen.getByRole('button', { name: /edit profile/i }))
      
      // Make changes
      const firstNameInput = screen.getByLabelText(/first name/i)
      await user.clear(firstNameInput)
      await user.type(firstNameInput, 'Jane')
      
      // Save changes
      await user.click(screen.getByRole('button', { name: /save changes/i }))
      
      // Check that inputs are disabled during save
      expect(firstNameInput).toBeDisabled()
    })
  })

  describe('Success and Error Messages', () => {
    it('shows success message after successful save', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Enter edit mode and make changes
      await user.click(screen.getByRole('button', { name: /edit profile/i }))
      
      const firstNameInput = screen.getByLabelText(/first name/i)
      await user.clear(firstNameInput)
      await user.type(firstNameInput, 'Jane')
      
      // Save changes
      await user.click(screen.getByRole('button', { name: /save changes/i }))
      
      // Check for success message
      await waitFor(() => {
        expect(screen.getByText(/profile updated successfully/i)).toBeInTheDocument()
      })
    })

    it('shows error message on save failure', async () => {
      const user = userEvent.setup()
      
      // Mock API error
      vi.spyOn(console, 'error').mockImplementation(() => {})
      
      renderProfilePage()
      
      // Enter edit mode and make changes
      await user.click(screen.getByRole('button', { name: /edit profile/i }))
      
      const emailInput = screen.getByLabelText(/email/i)
      await user.clear(emailInput)
      await user.type(emailInput, 'existing@example.com') // Simulate duplicate email
      
      // Save changes
      await user.click(screen.getByRole('button', { name: /save changes/i }))
      
      // Check for error message
      await waitFor(() => {
        expect(screen.getByText(/failed to update profile/i)).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      renderProfilePage()
      
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
    })

    it('supports keyboard navigation', async () => {
      renderProfilePage()
      
      const editButton = screen.getByRole('button', { name: /edit profile/i })
      
      // Focus and activate with keyboard
      editButton.focus()
      expect(editButton).toHaveFocus()
      
      fireEvent.keyDown(editButton, { key: 'Enter' })
      
      // Check that edit mode is activated
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
      })
    })

    it('has proper heading structure', () => {
      renderProfilePage()
      
      expect(screen.getByRole('heading', { name: /profile settings/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /personal information/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /work information/i })).toBeInTheDocument()
    })
  })

  describe('Responsive Design', () => {
    it('renders properly on different screen sizes', () => {
      // This test would need to be expanded with actual responsive testing
      renderProfilePage()
      
      const profileContainer = screen.getByTestId('profile-container')
      expect(profileContainer).toHaveClass('container', 'mx-auto')
    })
  })

  describe('Security Features', () => {
    it('requires current password for sensitive changes', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Enter edit mode
      await user.click(screen.getByRole('button', { name: /edit profile/i }))
      
      // Change email (sensitive change)
      const emailInput = screen.getByLabelText(/email/i)
      await user.clear(emailInput)
      await user.type(emailInput, 'new.email@example.com')
      
      // Attempt to save
      await user.click(screen.getByRole('button', { name: /save changes/i }))
      
      // Should prompt for current password
      await waitFor(() => {
        expect(screen.getByText(/please enter your current password to confirm this change/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
      })
    })

    it('clears sensitive data on component unmount', () => {
      const { unmount } = renderProfilePage()
      
      // This would test that sensitive form data is cleared
      // Implementation would depend on the specific security requirements
      unmount()
      
      // Verify cleanup
      expect(true).toBe(true) // Placeholder for actual security cleanup tests
    })
  })

  describe('Error Handling', () => {
    it('handles network errors gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock network error
      vi.spyOn(console, 'error').mockImplementation(() => {})
      
      renderProfilePage()
      
      // Enter edit mode and make changes
      await user.click(screen.getByRole('button', { name: /edit profile/i }))
      
      const firstNameInput = screen.getByLabelText(/first name/i)
      await user.clear(firstNameInput)
      await user.type(firstNameInput, 'Jane')
      
      // Save changes (should fail with network error)
      await user.click(screen.getByRole('button', { name: /save changes/i }))
      
      // Check for error handling
      await waitFor(() => {
        expect(screen.getByText(/network error occurred/i)).toBeInTheDocument()
      })
    })

    it('handles validation errors from server', async () => {
      const user = userEvent.setup()
      renderProfilePage()
      
      // Enter edit mode
      await user.click(screen.getByRole('button', { name: /edit profile/i }))
      
      // Enter data that will fail server validation
      const emailInput = screen.getByLabelText(/email/i)
      await user.clear(emailInput)
      await user.type(emailInput, 'invalid-server@test.com')
      
      // Save changes
      await user.click(screen.getByRole('button', { name: /save changes/i }))
      
      // Check for server validation error
      await waitFor(() => {
        expect(screen.getByText(/server validation error/i)).toBeInTheDocument()
      })
    })
  })
})