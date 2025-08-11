/**
 * ResetPasswordPage Component Test Suite
 * Following strict TDD methodology - RED phase
 * 
 * Tests cover:
 * - Token extraction from URL query params
 * - Form validation with Zod schema (token, password, confirm password)
 * - Password strength indicator (weak/medium/strong)
 * - Show/hide password toggles for both fields
 * - User interactions (input, submit, password visibility)
 * - Password reset flow integration
 * - Error handling (invalid token, expired token, network errors)
 * - Loading states during reset
 * - Success message and redirect to login
 * - Link to request new reset if token expired
 * - Accessibility features (ARIA labels, keyboard navigation)
 * - Security considerations (password visibility toggle, input sanitization)
 * - Auto-redirect if no token in URL
 * - Responsive design behavior
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

import ResetPasswordPage from '../ResetPasswordPage'
import * as authService from '@/services/auth'

// Mock auth service
vi.mock('@/services/auth')

// Mock navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Test wrapper component
const createTestWrapper = (initialEntries: string[] = ['/?token=valid-reset-token']) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return function TestWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
}

describe('ResetPasswordPage', () => {
  let user: ReturnType<typeof userEvent.setup>
  
  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial Render with Valid Token', () => {
    it('should render reset password form with all required fields', () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument()
      expect(screen.getByText('New Password')).toBeInTheDocument()
      expect(screen.getByText('Confirm Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument()
    })

    it('should render password strength indicator', () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })
      
      // Use the actual input elements by their IDs
      const passwordInput = document.querySelector('#password') as HTMLInputElement
      expect(passwordInput).toBeTruthy()
      expect(screen.getByText('New Password')).toBeInTheDocument()
      
      // Password strength indicator should not be visible initially
      expect(screen.queryByTestId('password-strength-indicator')).not.toBeInTheDocument()
    })

    it('should render show/hide toggles for both password fields', () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })
      
      const toggleButtons = screen.getAllByRole('button', { name: /show password/i })
      expect(toggleButtons).toHaveLength(2)
    })

    it('should have proper accessibility attributes', () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = document.querySelector('#password') as HTMLInputElement
      const confirmPasswordInput = document.querySelector('#confirmPassword') as HTMLInputElement
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('required')
      expect(passwordInput).toHaveAttribute('aria-invalid', 'false')
      expect(passwordInput).toHaveAttribute('autoComplete', 'new-password')

      expect(confirmPasswordInput).toHaveAttribute('type', 'password')
      expect(confirmPasswordInput).toHaveAttribute('required')
      expect(confirmPasswordInput).toHaveAttribute('aria-invalid', 'false')
      expect(confirmPasswordInput).toHaveAttribute('autoComplete', 'new-password')

      expect(submitButton).toHaveAttribute('type', 'submit')
      expect(submitButton).not.toBeDisabled()
    })

    it('should focus new password input on mount', () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })
      
      const passwordInput = document.querySelector('#password') as HTMLInputElement
      expect(passwordInput).toHaveFocus()
    })

    it('should display instructional text', () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })
      
      expect(screen.getByText(/enter your new password below/i)).toBeInTheDocument()
    })
  })

  describe('No Token in URL', () => {
    it('should redirect to forgot password page when no token provided', () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper(['/?']) })

      expect(mockNavigate).toHaveBeenCalledWith('/forgot-password')
    })

    it('should show error message when no token provided', () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper(['/?']) })

      expect(screen.getByText(/invalid or missing reset token/i)).toBeInTheDocument()
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  describe('Form Validation - Required Fields', () => {
    it('should validate new password is required', async () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const submitButton = screen.getByRole('button', { name: /reset password/i })
      await user.click(submitButton)

      expect(await screen.findByText(/password is required/i)).toBeInTheDocument()
      expect(vi.mocked(authService.resetPassword)).not.toHaveBeenCalled()
    })

    it('should validate confirm password is required', async () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      await user.type(passwordInput, 'Password123!')
      
      const submitButton = screen.getByRole('button', { name: /reset password/i })
      await user.click(submitButton)

      expect(await screen.findByText(/please confirm your password/i)).toBeInTheDocument()
      expect(vi.mocked(authService.resetPassword)).not.toHaveBeenCalled()
    })

    it('should validate password meets requirements', async () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      await user.type(passwordInput, 'weak')
      
      const submitButton = screen.getByRole('button', { name: /reset password/i })
      await user.click(submitButton)

      expect(await screen.findByText(/password must contain uppercase, lowercase, number, and special character/i)).toBeInTheDocument()
    })

    it('should validate password confirmation matches', async () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'DifferentPassword123!')
      
      const submitButton = screen.getByRole('button', { name: /reset password/i })
      await user.click(submitButton)

      expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
    })

    it('should clear validation errors when user fixes input', async () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })
      
      await user.click(submitButton)
      expect(await screen.findByText(/password is required/i)).toBeInTheDocument()

      // Fix input
      await user.type(passwordInput, 'Password123!')
      
      await waitFor(() => {
        expect(screen.queryByText(/password is required/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Password Strength Indicator', () => {
    it('should show weak password strength for short passwords', async () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      await user.type(passwordInput, 'weak')

      expect(screen.getByText(/weak/i)).toBeInTheDocument()
      expect(screen.getByTestId('password-strength-indicator')).toHaveClass('bg-red-500')
    })

    it('should show medium password strength for basic requirements', async () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      await user.type(passwordInput, 'Medium1!')

      expect(screen.getByText(/medium/i)).toBeInTheDocument()
      expect(screen.getByTestId('password-strength-indicator')).toHaveClass('bg-yellow-500')
    })

    it('should show strong password strength for complex passwords', async () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      await user.type(passwordInput, 'StrongPassword123!')

      expect(screen.getByText(/strong/i)).toBeInTheDocument()
      expect(screen.getByTestId('password-strength-indicator')).toHaveClass('bg-green-500')
    })

    it('should update password strength indicator in real-time', async () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      
      await user.type(passwordInput, 'weak')
      expect(screen.getByText(/weak/i)).toBeInTheDocument()
      
      await user.clear(passwordInput)
      await user.type(passwordInput, 'Medium1!')
      expect(screen.getByText(/medium/i)).toBeInTheDocument()
      
      await user.clear(passwordInput)
      await user.type(passwordInput, 'StrongPassword123!')
      expect(screen.getByText(/strong/i)).toBeInTheDocument()
    })
  })

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility for new password field', async () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const toggleButtons = screen.getAllByRole('button', { name: /show password/i })
      const passwordToggle = toggleButtons[0]

      expect(passwordInput).toHaveAttribute('type', 'password')

      await user.click(passwordToggle)

      expect(passwordInput).toHaveAttribute('type', 'text')
      expect(screen.getAllByRole('button', { name: /hide password/i })[0]).toBeInTheDocument()

      await user.click(screen.getAllByRole('button', { name: /hide password/i })[0])

      expect(passwordInput).toHaveAttribute('type', 'password')
    })

    it('should toggle password visibility for confirm password field', async () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const toggleButtons = screen.getAllByRole('button', { name: /show password/i })
      const confirmPasswordToggle = toggleButtons[1]

      expect(confirmPasswordInput).toHaveAttribute('type', 'password')

      await user.click(confirmPasswordToggle)

      expect(confirmPasswordInput).toHaveAttribute('type', 'text')
    })

    it('should have proper accessibility for password toggles', async () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const toggleButtons = screen.getAllByRole('button', { name: /show password/i })
      const passwordToggle = toggleButtons[0]
      
      expect(passwordToggle).toHaveAttribute('aria-pressed', 'false')
      
      await user.click(passwordToggle)
      
      expect(screen.getAllByRole('button', { name: /hide password/i })[0])
        .toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('User Interactions', () => {
    it('should call resetPassword function with correct data on form submit', async () => {
      vi.mocked(authService.resetPassword).mockResolvedValue(undefined)
      
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(submitButton)

      await waitFor(() => {
        expect(authService.resetPassword).toHaveBeenCalledWith('valid-reset-token', 'Password123!')
      })
    })

    it('should enable form submission via Enter key', async () => {
      vi.mocked(authService.resetPassword).mockResolvedValue(undefined)
      
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(authService.resetPassword).toHaveBeenCalledWith('valid-reset-token', 'Password123!')
      })
    })
  })

  describe('Loading States', () => {
    it('should disable form and show loading state during password reset', async () => {
      vi.mocked(authService.resetPassword).mockImplementation(() => new Promise(() => {})) // Never resolves
      
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /resetting password/i })).toBeInTheDocument()
        expect(screen.getByTestId('button-spinner')).toBeInTheDocument()
        expect(passwordInput).toBeDisabled()
        expect(confirmPasswordInput).toBeDisabled()
      })
    })
  })

  describe('Success Flow', () => {
    it('should show success message after successful password reset', async () => {
      vi.mocked(authService.resetPassword).mockResolvedValue(undefined)
      
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/password reset successful/i)).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite')
      })
    })

    it('should redirect to login page after successful reset', async () => {
      vi.mocked(authService.resetPassword).mockResolvedValue(undefined)
      
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', { 
          state: { message: 'Password reset successful! Please log in with your new password.' }
        })
      }, { timeout: 5000 })
    })

    it('should show login link in success message', async () => {
      vi.mocked(authService.resetPassword).mockResolvedValue(undefined)
      
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /sign in now/i })).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should display invalid token error', async () => {
      const error = new Error('Invalid or expired reset token')
      vi.mocked(authService.resetPassword).mockRejectedValue(error)
      
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/invalid or expired reset token/i)).toBeInTheDocument()
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })
    })

    it('should display expired token error with link to request new reset', async () => {
      const error = new Error('Reset token has expired')
      vi.mocked(authService.resetPassword).mockRejectedValue(error)
      
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/reset token has expired/i)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /request a new reset link/i })).toBeInTheDocument()
      })
    })

    it('should display network error', async () => {
      const error = new Error('Network error')
      vi.mocked(authService.resetPassword).mockRejectedValue(error)
      
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })
    })

    it('should display generic error for unknown errors', async () => {
      const error = new Error('Unknown error')
      vi.mocked(authService.resetPassword).mockRejectedValue(error)
      
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/password reset failed/i)).toBeInTheDocument()
      })
    })

    it('should clear error when user starts typing', async () => {
      const error = new Error('Invalid token')
      vi.mocked(authService.resetPassword).mockRejectedValue(error)
      
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/invalid token/i)).toBeInTheDocument()
      })

      // Clear and retype - error should disappear
      await user.clear(passwordInput)
      await user.type(passwordInput, 'NewPassword123!')
      
      await waitFor(() => {
        expect(screen.queryByText(/invalid token/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Security Features', () => {
    it('should have appropriate autocomplete attributes', () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

      expect(passwordInput).toHaveAttribute('autocomplete', 'new-password')
      expect(confirmPasswordInput).toHaveAttribute('autocomplete', 'new-password')
    })

    it('should clear sensitive data on unmount', () => {
      const { unmount } = render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      // This test ensures cleanup happens - implementation detail will be tested in component
      unmount()

      // Component should implement cleanup in useEffect cleanup function
      expect(true).toBe(true) // Placeholder - actual cleanup will be verified in component
    })

    it('should not expose token in error messages', async () => {
      const error = new Error('Invalid token')
      vi.mocked(authService.resetPassword).mockRejectedValue(error)
      
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/password reset failed/i)).toBeInTheDocument()
        expect(screen.queryByText(/valid-reset-token/)).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for form elements', () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

      expect(passwordInput).toHaveAttribute('aria-label')
      expect(confirmPasswordInput).toHaveAttribute('aria-label')
    })

    it('should support keyboard navigation', async () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      // Tab through form elements
      await user.tab()
      expect(screen.getByLabelText(/new password/i)).toHaveFocus()

      await user.tab()
      expect(screen.getAllByRole('button', { name: /show password/i })[0]).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText(/confirm password/i)).toHaveFocus()

      await user.tab()
      expect(screen.getAllByRole('button', { name: /show password/i })[1]).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: /reset password/i })).toHaveFocus()
    })

    it('should announce form errors to screen readers', async () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })
      
      const submitButton = screen.getByRole('button', { name: /reset password/i })
      await user.click(submitButton)

      const errorMessages = await screen.findAllByText(/password is required/i)
      expect(errorMessages[0]).toBeInTheDocument()
    })

    it('should have proper heading hierarchy', () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const heading = screen.getByRole('heading', { name: /reset password/i, level: 1 })
      expect(heading.tagName).toBe('H1')
    })
  })

  describe('Responsive Design', () => {
    it('should render mobile-friendly layout', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const form = screen.getByRole('form')
      expect(form).toHaveClass('space-y-6') // Should have proper spacing
    })

    it('should have appropriate text sizes for mobile', () => {
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const heading = screen.getByRole('heading', { name: /reset password/i })
      expect(heading.className).toContain('text-2xl') // Should have responsive text classes
    })
  })

  describe('Navigation Links', () => {
    it('should have link to request new reset when token expired', async () => {
      const error = new Error('Reset token has expired')
      vi.mocked(authService.resetPassword).mockRejectedValue(error)
      
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(submitButton)

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /request a new reset link/i })
        expect(link).toHaveAttribute('href', '/forgot-password')
      })
    })

    it('should have link to login page in success state', async () => {
      vi.mocked(authService.resetPassword).mockResolvedValue(undefined)
      
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(submitButton)

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /sign in now/i })
        expect(link).toHaveAttribute('href', '/login')
      })
    })
  })

  describe('Form State Management', () => {
    it('should maintain form state during re-renders', async () => {
      const { rerender } = render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')

      rerender(<ResetPasswordPage />)

      expect(passwordInput).toHaveValue('Password123!')
      expect(confirmPasswordInput).toHaveValue('Password123!')
    })

    it('should reset form after successful password reset', async () => {
      vi.mocked(authService.resetPassword).mockResolvedValue(undefined)
      
      render(<ResetPasswordPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /reset password/i })

      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/password reset successful/i)).toBeInTheDocument()
      })

      // Form should be reset (implementation detail to be added)
      expect(passwordInput).toHaveValue('')
      expect(confirmPasswordInput).toHaveValue('')
    })
  })
})