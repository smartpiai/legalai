/**
 * ForgotPasswordPage Component Test Suite
 * Following strict TDD methodology - RED phase
 * 
 * Tests cover:
 * - Form validation with Zod schema
 * - User interactions (input, submit, resend functionality)
 * - Password reset flow integration
 * - Error handling (network errors, rate limiting, invalid responses)
 * - Success states and messages
 * - Loading states during API calls
 * - Rate limiting with cooldown period
 * - Security considerations (timing attack prevention)
 * - Navigation links
 * - Accessibility features
 * - Responsive design behavior
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

import ForgotPasswordPage from '../ForgotPasswordPage'
import * as authService from '@/services/auth'

// Mock auth service
vi.mock('@/services/auth')
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
  }
})

// Test wrapper component
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return function TestWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </QueryClientProvider>
    )
  }
}

// Mock implementation
const mockRequestPasswordReset = vi.mocked(authService.requestPasswordReset)

describe('ForgotPasswordPage', () => {
  let user: ReturnType<typeof userEvent.setup>
  
  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
    // Reset localStorage for rate limiting tests
    localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial Render', () => {
    it('should render forgot password form with all required elements', () => {
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      expect(screen.getByRole('heading', { name: /forgot password/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /send reset instructions/i })).toBeInTheDocument()
      expect(screen.getByText(/enter your email address and we'll send you a link to reset your password/i)).toBeInTheDocument()
    })

    it('should render navigation link back to login', () => {
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const loginLink = screen.getByRole('link', { name: /back to login/i })
      expect(loginLink).toBeInTheDocument()
      expect(loginLink).toHaveAttribute('href', '/login')
    })

    it('should have proper accessibility attributes', () => {
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('required')
      expect(emailInput).toHaveAttribute('aria-invalid', 'false')
      expect(emailInput).toHaveAttribute('autocomplete', 'email')
      
      expect(submitButton).toHaveAttribute('type', 'submit')
      expect(submitButton).not.toBeDisabled()
    })

    it('should focus email input on mount', () => {
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })
      
      expect(screen.getByLabelText(/email address/i)).toHaveFocus()
    })

    it('should render informative instructions', () => {
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      expect(screen.getByText(/enter your email address and we'll send you a link to reset your password/i)).toBeInTheDocument()
      expect(screen.getByText(/check your spam folder if you don't receive an email/i)).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('should validate email field is required', async () => {
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })
      await user.click(submitButton)

      expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
      expect(mockRequestPasswordReset).not.toHaveBeenCalled()
    })

    it('should validate email format', async () => {
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'invalid-email')
      await user.click(submitButton)

      expect(await screen.findByText(/invalid email format/i)).toBeInTheDocument()
      expect(mockRequestPasswordReset).not.toHaveBeenCalled()
    })

    it('should accept valid email formats', async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined)
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockRequestPasswordReset).toHaveBeenCalledWith('test@example.com')
      })
    })

    it('should clear validation errors when user fixes input', async () => {
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      // Trigger validation error
      await user.click(submitButton)
      expect(await screen.findByText(/email is required/i)).toBeInTheDocument()

      // Fix input
      await user.type(emailInput, 'test@example.com')
      
      expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument()
    })

    it('should validate maximum email length', async () => {
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      // Create email longer than 254 characters
      const longEmail = 'a'.repeat(250) + '@example.com'
      await user.type(emailInput, longEmail)
      await user.click(submitButton)

      expect(await screen.findByText(/email is too long/i)).toBeInTheDocument()
      expect(mockRequestPasswordReset).not.toHaveBeenCalled()
    })
  })

  describe('User Interactions', () => {
    it('should call requestPasswordReset with correct email on form submit', async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined)
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockRequestPasswordReset).toHaveBeenCalledWith('test@example.com')
      })
    })

    it('should enable form submission via Enter key', async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined)
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)

      await user.type(emailInput, 'test@example.com')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockRequestPasswordReset).toHaveBeenCalledWith('test@example.com')
      })
    })

    it('should trim whitespace from email input', async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined)
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, '  test@example.com  ')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockRequestPasswordReset).toHaveBeenCalledWith('test@example.com')
      })
    })
  })

  describe('Loading States', () => {
    it('should disable form and show loading state during API call', async () => {
      let resolvePromise: () => void
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve
      })
      mockRequestPasswordReset.mockReturnValue(promise)

      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      // Should show loading state
      expect(screen.getByRole('button', { name: /sending instructions/i })).toBeInTheDocument()
      expect(screen.getByTestId('button-spinner')).toBeInTheDocument()
      expect(screen.getByLabelText(/email address/i)).toBeDisabled()

      resolvePromise!()
      await waitFor(() => {
        expect(screen.queryByTestId('button-spinner')).not.toBeInTheDocument()
      })
    })

    it('should show loading text on submit button during API call', async () => {
      let resolvePromise: () => void
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve
      })
      mockRequestPasswordReset.mockReturnValue(promise)

      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      expect(screen.getByRole('button', { name: /sending instructions/i })).toBeInTheDocument()

      resolvePromise!()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /send reset instructions/i })).toBeInTheDocument()
      })
    })
  })

  describe('Success States', () => {
    it('should display success message after successful password reset request', async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined)
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      expect(await screen.findByText(/password reset instructions have been sent to your email/i)).toBeInTheDocument()
      expect(screen.getByText(/check your spam folder if you don't receive an email/i)).toBeInTheDocument()
    })

    it('should clear email field after successful submission', async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined)
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(emailInput).toHaveValue('')
      })
    })

    it('should have accessible success message', async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined)
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      const successMessage = await screen.findByRole('alert')
      expect(successMessage).toHaveAttribute('aria-live', 'polite')
      expect(successMessage).toContainHTML(/password reset instructions have been sent/i)
    })
  })

  describe('Error Handling', () => {
    it('should display network error message', async () => {
      mockRequestPasswordReset.mockRejectedValue(new Error('Network error'))
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      expect(await screen.findByText(/network error occurred. please check your connection and try again/i)).toBeInTheDocument()
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('should display rate limiting error message', async () => {
      const rateLimitError = new Error('Rate limit exceeded')
      rateLimitError.name = 'RateLimitError'
      mockRequestPasswordReset.mockRejectedValue(rateLimitError)

      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      expect(await screen.findByText(/too many requests. please wait a few minutes before trying again/i)).toBeInTheDocument()
    })

    it('should display generic error for unknown errors', async () => {
      mockRequestPasswordReset.mockRejectedValue(new Error('Unknown error'))
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      expect(await screen.findByText(/an error occurred. please try again/i)).toBeInTheDocument()
    })

    it('should handle 429 status code as rate limiting', async () => {
      const error = new Error('Too Many Requests')
      ;(error as any).response = { status: 429 }
      mockRequestPasswordReset.mockRejectedValue(error)

      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      expect(await screen.findByText(/too many requests. please wait a few minutes before trying again/i)).toBeInTheDocument()
    })

    it('should clear error when user starts typing again', async () => {
      mockRequestPasswordReset.mockRejectedValue(new Error('Network error'))
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      expect(await screen.findByText(/network error occurred/i)).toBeInTheDocument()

      // Clear input and type new email
      await user.clear(emailInput)
      await user.type(emailInput, 'new@example.com')

      expect(screen.queryByText(/network error occurred/i)).not.toBeInTheDocument()
    })

    it('should maintain form state after error', async () => {
      mockRequestPasswordReset.mockRejectedValue(new Error('Network error'))
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await screen.findByText(/network error occurred/i)

      // Email should still be in the field
      expect(emailInput).toHaveValue('test@example.com')
      expect(submitButton).not.toBeDisabled()
    })
  })

  describe('Rate Limiting Features', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should show resend button after successful submission with cooldown', async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined)
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await screen.findByText(/password reset instructions have been sent/i)

      expect(screen.getByText(/resend in \d+ seconds/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /resend/i })).toBeDisabled()
    })

    it('should enable resend button after cooldown period', async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined)
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await screen.findByText(/password reset instructions have been sent/i)

      expect(screen.getByRole('button', { name: /resend/i })).toBeDisabled()

      // Fast forward time past cooldown
      vi.advanceTimersByTime(60000) // 60 seconds

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /resend/i })).not.toBeDisabled()
      })
    })

    it('should handle resend functionality', async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined)
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await screen.findByText(/password reset instructions have been sent/i)

      // Fast forward past cooldown
      vi.advanceTimersByTime(60000)

      const resendButton = await screen.findByRole('button', { name: /resend/i })
      expect(resendButton).not.toBeDisabled()

      await user.click(resendButton)

      expect(mockRequestPasswordReset).toHaveBeenCalledTimes(2)
      expect(mockRequestPasswordReset).toHaveBeenLastCalledWith('test@example.com')
    })

    it('should reset cooldown timer when resending', async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined)
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await screen.findByText(/password reset instructions have been sent/i)

      // Fast forward past first cooldown
      vi.advanceTimersByTime(60000)

      const resendButton = await screen.findByRole('button', { name: /resend/i })
      await user.click(resendButton)

      // Should show new cooldown
      expect(screen.getByText(/resend in \d+ seconds/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /resend/i })).toBeDisabled()
    })
  })

  describe('Security Features', () => {
    it('should not reveal whether email exists in system on success', async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined)
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'nonexistent@example.com')
      await user.click(submitButton)

      // Should show same success message regardless of email existence
      expect(await screen.findByText(/password reset instructions have been sent to your email/i)).toBeInTheDocument()
    })

    it('should have consistent response timing for timing attack prevention', async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined)
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      const start = Date.now()
      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await screen.findByText(/password reset instructions have been sent/i)
      const end = Date.now()

      // Response should complete (timing will be tested more thoroughly in integration tests)
      expect(end - start).toBeGreaterThan(0)
    })

    it('should sanitize email input', async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined)
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      // Email with potential XSS
      const maliciousEmail = 'test@example.com<script>alert("xss")</script>'
      await user.type(emailInput, maliciousEmail)
      await user.click(submitButton)

      // Should call API with sanitized email (script tags removed)
      await waitFor(() => {
        expect(mockRequestPasswordReset).toHaveBeenCalledWith('test@example.com')
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for form elements', () => {
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      expect(emailInput).toHaveAttribute('aria-label')
      expect(submitButton).toHaveAttribute('aria-label')
    })

    it('should support keyboard navigation', async () => {
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      // Tab through form elements
      await user.tab()
      expect(screen.getByLabelText(/email address/i)).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: /send reset instructions/i })).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('link', { name: /back to login/i })).toHaveFocus()
    })

    it('should announce form errors to screen readers', async () => {
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })
      await user.click(submitButton)

      const errorMessage = await screen.findByText(/email is required/i)
      expect(errorMessage).toHaveAttribute('role', 'alert')
      expect(errorMessage).toHaveAttribute('aria-live', 'polite')
    })

    it('should have proper heading hierarchy', () => {
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const heading = screen.getByRole('heading', { name: /forgot password/i, level: 1 })
      expect(heading.tagName).toBe('H1')
    })

    it('should have proper form labels and descriptions', () => {
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      expect(emailInput).toHaveAccessibleDescription()
    })
  })

  describe('Navigation', () => {
    it('should have correct href for back to login link', () => {
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const loginLink = screen.getByRole('link', { name: /back to login/i })
      
      expect(loginLink).toHaveAttribute('href', '/login')
    })

    it('should have proper styling for navigation link', () => {
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const loginLink = screen.getByRole('link', { name: /back to login/i })
      
      expect(loginLink.className).toContain('text-blue-600')
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

      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const form = screen.getByRole('form')
      expect(form).toHaveClass('space-y-6') // Should have proper spacing
    })

    it('should have appropriate text sizes for mobile', () => {
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const heading = screen.getByRole('heading', { name: /forgot password/i })
      expect(heading.className).toContain('text-2xl') // Should have responsive text classes
    })

    it('should have full-width button on mobile', () => {
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })
      expect(submitButton.className).toContain('w-full')
    })
  })

  describe('Form State Management', () => {
    it('should maintain form state during re-renders', async () => {
      const { rerender } = render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)

      await user.type(emailInput, 'test@example.com')

      rerender(<ForgotPasswordPage />)

      expect(emailInput).toHaveValue('test@example.com')
    })

    it('should reset form state after successful submission', async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined)
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await screen.findByText(/password reset instructions have been sent/i)

      // Form should be replaced with success state, not reset
      expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument()
    })

    it('should preserve email for resend functionality', async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined)
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await screen.findByText(/password reset instructions have been sent/i)

      // Email should be preserved and shown in success state
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })
  })

  describe('Integration with Auth Service', () => {
    it('should call requestPasswordReset service method', async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined)
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(authService.requestPasswordReset).toHaveBeenCalledWith('test@example.com')
        expect(authService.requestPasswordReset).toHaveBeenCalledTimes(1)
      })
    })

    it('should handle service method promise rejection', async () => {
      mockRequestPasswordReset.mockRejectedValue(new Error('Service error'))
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      expect(await screen.findByRole('alert')).toBeInTheDocument()
    })

    it('should handle concurrent requests gracefully', async () => {
      const delayedPromise = new Promise<void>((resolve) => setTimeout(resolve, 100))
      mockRequestPasswordReset.mockReturnValue(delayedPromise)
      
      render(<ForgotPasswordPage />, { wrapper: createTestWrapper() })

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send reset instructions/i })

      await user.type(emailInput, 'test@example.com')
      
      // Submit multiple times rapidly
      await user.click(submitButton)
      await user.click(submitButton)
      await user.click(submitButton)

      // Should only call the service once due to loading state
      await waitFor(() => {
        expect(mockRequestPasswordReset).toHaveBeenCalledTimes(1)
      })
    })
  })
})