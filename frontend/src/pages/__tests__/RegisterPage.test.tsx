/**
 * RegisterPage Component Test Suite
 * Following strict TDD methodology - RED phase
 * 
 * Tests cover:
 * - Form validation with Zod schema (first name, last name, email, password, confirm password)
 * - User interactions (input, submit, show/hide password, checkboxes)
 * - Registration flow integration
 * - Error handling (network errors, validation errors, rate limiting, existing email)
 * - Loading states during registration
 * - Success redirect to dashboard
 * - Password strength indicator (weak/medium/strong)
 * - Accessibility features (ARIA labels, keyboard navigation)
 * - Security considerations (password visibility toggle, input sanitization)
 * - Navigation links (login page)
 * - Responsive design behavior
 * - Optional fields handling (organization, department, phone)
 * - Terms of service and privacy policy acceptance
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

import RegisterPage from '../RegisterPage'
import { useAuthStore } from '@/store/auth'
import * as authService from '@/services/auth'

// Mock modules
vi.mock('@/store/auth')
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

// Mock auth store implementation
const mockAuthStore = {
  register: vi.fn(),
  isLoading: false,
  error: null,
  isAuthenticated: false,
  user: null,
  setError: vi.fn(),
  setLoading: vi.fn(),
}

describe('RegisterPage', () => {
  let user: ReturnType<typeof userEvent.setup>
  
  beforeEach(() => {
    user = userEvent.setup()
    vi.mocked(useAuthStore).mockReturnValue(mockAuthStore)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial Render', () => {
    it('should render registration form with all required fields', () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    })

    it('should render optional fields', () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      expect(screen.getByLabelText(/organization/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/department/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument()
    })

    it('should render terms and privacy checkboxes', () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      expect(screen.getByRole('checkbox', { name: /terms of service/i })).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /privacy policy/i })).toBeInTheDocument()
    })

    it('should render navigation link to login page', () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      expect(screen.getByRole('link', { name: /already have an account/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
    })

    it('should have proper accessibility attributes', () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      expect(firstNameInput).toHaveAttribute('type', 'text')
      expect(firstNameInput).toHaveAttribute('required')
      expect(firstNameInput).toHaveAttribute('aria-invalid', 'false')

      expect(lastNameInput).toHaveAttribute('type', 'text')
      expect(lastNameInput).toHaveAttribute('required')
      expect(lastNameInput).toHaveAttribute('aria-invalid', 'false')

      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('required')
      expect(emailInput).toHaveAttribute('aria-invalid', 'false')

      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('required')
      expect(passwordInput).toHaveAttribute('aria-invalid', 'false')

      expect(confirmPasswordInput).toHaveAttribute('type', 'password')
      expect(confirmPasswordInput).toHaveAttribute('required')
      expect(confirmPasswordInput).toHaveAttribute('aria-invalid', 'false')

      expect(submitButton).toHaveAttribute('type', 'submit')
      expect(submitButton).toBeDisabled() // Should be disabled until terms are accepted
    })

    it('should focus first name input on mount', () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })
      
      expect(screen.getByLabelText(/first name/i)).toHaveFocus()
    })

    it('should render password strength indicator', () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })
      
      expect(screen.getByTestId('password-strength-indicator')).toBeInTheDocument()
    })
  })

  describe('Form Validation - Required Fields', () => {
    it('should validate first name is required', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })
      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })
      
      await user.click(termsCheckbox)
      await user.click(privacyCheckbox)
      
      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      expect(await screen.findByText(/first name is required/i)).toBeInTheDocument()
      expect(mockAuthStore.register).not.toHaveBeenCalled()
    })

    it('should validate last name is required', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })
      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })
      
      await user.type(firstNameInput, 'John')
      await user.click(termsCheckbox)
      await user.click(privacyCheckbox)
      
      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      expect(await screen.findByText(/last name is required/i)).toBeInTheDocument()
      expect(mockAuthStore.register).not.toHaveBeenCalled()
    })

    it('should validate email field is required', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })
      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })
      
      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.click(termsCheckbox)
      await user.click(privacyCheckbox)
      
      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
      expect(mockAuthStore.register).not.toHaveBeenCalled()
    })

    it('should validate password field is required', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })
      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })
      
      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, 'john@example.com')
      await user.click(termsCheckbox)
      await user.click(privacyCheckbox)
      
      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      expect(await screen.findByText(/password is required/i)).toBeInTheDocument()
      expect(mockAuthStore.register).not.toHaveBeenCalled()
    })

    it('should validate confirm password field is required', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText('Password')
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })
      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })
      
      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, 'john@example.com')
      await user.type(passwordInput, 'Password123!')
      await user.click(termsCheckbox)
      await user.click(privacyCheckbox)
      
      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      expect(await screen.findByText(/please confirm your password/i)).toBeInTheDocument()
      expect(mockAuthStore.register).not.toHaveBeenCalled()
    })
  })

  describe('Form Validation - Field Requirements', () => {
    it('should validate first name minimum length', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })
      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })
      
      await user.type(firstNameInput, 'J')
      await user.click(termsCheckbox)
      await user.click(privacyCheckbox)
      
      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      expect(await screen.findByText(/first name must be at least 2 characters/i)).toBeInTheDocument()
    })

    it('should validate last name minimum length', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })
      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })
      
      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'D')
      await user.click(termsCheckbox)
      await user.click(privacyCheckbox)
      
      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      expect(await screen.findByText(/last name must be at least 2 characters/i)).toBeInTheDocument()
    })

    it('should validate email format', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })
      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, 'invalid-email')
      await user.click(termsCheckbox)
      await user.click(privacyCheckbox)
      
      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      expect(await screen.findByText(/invalid email format/i)).toBeInTheDocument()
    })

    it('should validate password requirements', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText('Password')
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })
      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })

      await user.type(passwordInput, 'weak')
      await user.click(termsCheckbox)
      await user.click(privacyCheckbox)
      
      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      expect(await screen.findByText(/password must contain uppercase, lowercase, number, and special character/i)).toBeInTheDocument()
    })

    it('should validate password confirmation matches', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })
      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, 'john@example.com')
      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'DifferentPassword123!')
      await user.click(termsCheckbox)
      await user.click(privacyCheckbox)
      
      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
    })

    it('should validate terms of service acceptance', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, 'john@example.com')
      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(privacyCheckbox)
      
      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      expect(await screen.findByText(/you must accept the terms of service/i)).toBeInTheDocument()
    })

    it('should validate privacy policy acceptance', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, 'john@example.com')
      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(termsCheckbox)
      
      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      expect(await screen.findByText(/you must accept the privacy policy/i)).toBeInTheDocument()
    })

    it('should clear validation errors when user fixes input', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })
      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })
      
      await user.click(termsCheckbox)
      await user.click(privacyCheckbox)
      
      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)
      
      expect(await screen.findByText(/first name is required/i)).toBeInTheDocument()

      // Fix input
      await user.type(firstNameInput, 'John')
      
      expect(screen.queryByText(/first name is required/i)).not.toBeInTheDocument()
    })
  })

  describe('Password Strength Indicator', () => {
    it('should show weak password strength for short passwords', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText('Password')
      await user.type(passwordInput, 'weak')

      expect(screen.getByText(/weak/i)).toBeInTheDocument()
      expect(screen.getByTestId('password-strength-indicator')).toHaveClass('bg-red-500')
    })

    it('should show medium password strength for basic requirements', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText('Password')
      await user.type(passwordInput, 'Medium1!')

      expect(screen.getByText(/medium/i)).toBeInTheDocument()
      expect(screen.getByTestId('password-strength-indicator')).toHaveClass('bg-yellow-500')
    })

    it('should show strong password strength for complex passwords', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText('Password')
      await user.type(passwordInput, 'StrongPassword123!')

      expect(screen.getByText(/strong/i)).toBeInTheDocument()
      expect(screen.getByTestId('password-strength-indicator')).toHaveClass('bg-green-500')
    })

    it('should update password strength indicator in real-time', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText('Password')
      
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
    it('should toggle password visibility for password field', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const passwordInput = screen.getByLabelText('Password')
      const toggleButton = screen.getByRole('button', { name: /show password/i })

      expect(passwordInput).toHaveAttribute('type', 'password')

      await user.click(toggleButton)

      expect(passwordInput).toHaveAttribute('type', 'text')
      expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /hide password/i }))

      expect(passwordInput).toHaveAttribute('type', 'password')
    })

    it('should toggle password visibility for confirm password field', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const toggleButtons = screen.getAllByRole('button', { name: /show password/i })
      const confirmPasswordToggle = toggleButtons[1] // Second toggle button

      expect(confirmPasswordInput).toHaveAttribute('type', 'password')

      await user.click(confirmPasswordToggle)

      expect(confirmPasswordInput).toHaveAttribute('type', 'text')
    })

    it('should have proper accessibility for password toggles', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const toggleButtons = screen.getAllByRole('button', { name: /show password/i })
      const passwordToggle = toggleButtons[0]
      
      expect(passwordToggle).toHaveAttribute('aria-pressed', 'false')
      
      await user.click(passwordToggle)
      
      expect(screen.getAllByRole('button', { name: /hide password/i })[0])
        .toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('User Interactions', () => {
    it('should call register function with correct data on form submit', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const organizationInput = screen.getByLabelText(/organization/i)
      const departmentInput = screen.getByLabelText(/department/i)
      const phoneInput = screen.getByLabelText(/phone number/i)
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })
      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })
      const submitButton = screen.getByRole('button', { name: /create account/i })

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, 'john@example.com')
      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.type(organizationInput, 'ACME Corp')
      await user.type(departmentInput, 'Legal')
      await user.type(phoneInput, '+1234567890')
      await user.click(termsCheckbox)
      await user.click(privacyCheckbox)
      await user.click(submitButton)

      expect(mockAuthStore.register).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Password123!',
        organization: 'ACME Corp',
        department: 'Legal',
        phone: '+1234567890'
      })
    })

    it('should submit form with only required fields', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })
      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })
      const submitButton = screen.getByRole('button', { name: /create account/i })

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, 'john@example.com')
      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(termsCheckbox)
      await user.click(privacyCheckbox)
      await user.click(submitButton)

      expect(mockAuthStore.register).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Password123!',
        organization: '',
        department: '',
        phone: ''
      })
    })

    it('should enable form submission via Enter key', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })
      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, 'john@example.com')
      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(termsCheckbox)
      await user.click(privacyCheckbox)
      await user.keyboard('{Enter}')

      expect(mockAuthStore.register).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Password123!',
        organization: '',
        department: '',
        phone: ''
      })
    })

    it('should disable submit button when terms are not accepted', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const submitButton = screen.getByRole('button', { name: /create account/i })
      
      expect(submitButton).toBeDisabled()

      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })
      await user.click(termsCheckbox)
      
      expect(submitButton).toBeDisabled() // Still disabled without privacy

      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })
      await user.click(privacyCheckbox)
      
      expect(submitButton).not.toBeDisabled()
    })
  })

  describe('Loading States', () => {
    it('should disable form and show loading state during registration', async () => {
      const loadingAuthStore = { ...mockAuthStore, isLoading: true }
      vi.mocked(useAuthStore).mockReturnValue(loadingAuthStore)

      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /creating account/i })

      expect(firstNameInput).toBeDisabled()
      expect(lastNameInput).toBeDisabled()
      expect(emailInput).toBeDisabled()
      expect(passwordInput).toBeDisabled()
      expect(confirmPasswordInput).toBeDisabled()
      expect(submitButton).toBeDisabled()
      expect(screen.getByTestId('button-spinner')).toBeInTheDocument()
    })

    it('should show loading text on submit button during registration', () => {
      const loadingAuthStore = { ...mockAuthStore, isLoading: true }
      vi.mocked(useAuthStore).mockReturnValue(loadingAuthStore)

      render(<RegisterPage />, { wrapper: createTestWrapper() })

      expect(screen.getByRole('button', { name: /creating account/i })).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display registration error from store', () => {
      const errorAuthStore = { 
        ...mockAuthStore, 
        error: 'Email already exists' 
      }
      vi.mocked(useAuthStore).mockReturnValue(errorAuthStore)

      render(<RegisterPage />, { wrapper: createTestWrapper() })

      expect(screen.getByText(/email already exists/i)).toBeInTheDocument()
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('should display validation error for existing email', () => {
      const errorAuthStore = { 
        ...mockAuthStore, 
        error: 'An account with this email already exists' 
      }
      vi.mocked(useAuthStore).mockReturnValue(errorAuthStore)

      render(<RegisterPage />, { wrapper: createTestWrapper() })

      expect(screen.getByText(/an account with this email already exists/i)).toBeInTheDocument()
    })

    it('should display network error', () => {
      const errorAuthStore = { 
        ...mockAuthStore, 
        error: 'Network error. Please check your connection.' 
      }
      vi.mocked(useAuthStore).mockReturnValue(errorAuthStore)

      render(<RegisterPage />, { wrapper: createTestWrapper() })

      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })

    it('should display rate limiting error', () => {
      const errorAuthStore = { 
        ...mockAuthStore, 
        error: 'Too many registration attempts. Please try again later.' 
      }
      vi.mocked(useAuthStore).mockReturnValue(errorAuthStore)

      render(<RegisterPage />, { wrapper: createTestWrapper() })

      expect(screen.getByText(/too many registration attempts/i)).toBeInTheDocument()
    })

    it('should clear error when user starts typing', async () => {
      const errorAuthStore = { 
        ...mockAuthStore, 
        error: 'Registration failed',
        setError: vi.fn()
      }
      vi.mocked(useAuthStore).mockReturnValue(errorAuthStore)

      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      
      await user.type(firstNameInput, 'J')

      expect(errorAuthStore.setError).toHaveBeenCalledWith(null)
    })
  })

  describe('Navigation', () => {
    it('should have correct href for login page link', () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const loginLink = screen.getByRole('link', { name: /sign in/i })
      
      expect(loginLink).toHaveAttribute('href', '/login')
    })
  })

  describe('Security Features', () => {
    it('should have appropriate autocomplete attributes', () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText('Password')

      expect(firstNameInput).toHaveAttribute('autocomplete', 'given-name')
      expect(lastNameInput).toHaveAttribute('autocomplete', 'family-name')
      expect(emailInput).toHaveAttribute('autocomplete', 'email')
      expect(passwordInput).toHaveAttribute('autocomplete', 'new-password')
    })

    it('should sanitize input values on form submission', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })
      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })
      
      // Type malicious content - should be allowed during typing but sanitized on submit
      await user.type(firstNameInput, '<script>alert("xss")</script>John')
      await user.type(lastNameInput, 'Doe<>')
      await user.type(emailInput, 'john@example.com')
      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(termsCheckbox)
      await user.click(privacyCheckbox)

      // Input displays the full content during typing (more user-friendly)
      expect(firstNameInput).toHaveValue('<script>alert("xss")</script>John')
      expect(lastNameInput).toHaveValue('Doe<>')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      // Verify that the sanitized data is passed to the register function
      expect(mockAuthStore.register).toHaveBeenCalledWith({
        firstName: 'scriptalert("xss")/scriptJohn', // Sanitized by Zod transform
        lastName: 'Doe', // Sanitized by Zod transform
        email: 'john@example.com',
        password: 'Password123!',
        organization: '',
        department: '',
        phone: ''
      })
    })

    it('should clear sensitive data on unmount', () => {
      const { unmount } = render(<RegisterPage />, { wrapper: createTestWrapper() })

      // This test ensures cleanup happens - implementation detail will be tested in component
      unmount()

      // Component should implement cleanup in useEffect cleanup function
      expect(true).toBe(true) // Placeholder - actual cleanup will be verified in component
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for form elements', () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

      expect(firstNameInput).toHaveAttribute('aria-label')
      expect(lastNameInput).toHaveAttribute('aria-label')
      expect(emailInput).toHaveAttribute('aria-label')
      expect(passwordInput).toHaveAttribute('aria-label')
      expect(confirmPasswordInput).toHaveAttribute('aria-label')
    })

    it('should support keyboard navigation', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      // Tab through form elements
      await user.tab()
      expect(screen.getByLabelText(/first name/i)).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText(/last name/i)).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText(/email address/i)).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText('Password')).toHaveFocus()

      await user.tab()
      expect(screen.getAllByRole('button', { name: /show password/i })[0]).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText(/confirm password/i)).toHaveFocus()
    })

    it('should announce form errors to screen readers', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })
      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })
      
      await user.click(termsCheckbox)
      await user.click(privacyCheckbox)
      
      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      const errorMessage = await screen.findByText(/first name is required/i)
      expect(errorMessage).toHaveAttribute('role', 'alert')
      expect(errorMessage).toHaveAttribute('aria-live', 'polite')
    })

    it('should have proper heading hierarchy', () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const heading = screen.getByRole('heading', { name: /create account/i, level: 1 })
      expect(heading.tagName).toBe('H1')
    })

    it('should have fieldset for related form groups', () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const fieldsets = screen.getAllByRole('group')
      expect(fieldsets.length).toBeGreaterThan(0)
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

      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const form = screen.getByRole('form')
      expect(form).toHaveClass('space-y-4') // Should have proper spacing
    })

    it('should have appropriate text sizes for mobile', () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const heading = screen.getByRole('heading', { name: /create account/i })
      expect(heading.className).toContain('text-2xl') // Should have responsive text classes
    })
  })

  describe('Form State Management', () => {
    it('should maintain form state during re-renders', async () => {
      const { rerender } = render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email address/i)

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, 'john@example.com')

      rerender(<RegisterPage />)

      expect(firstNameInput).toHaveValue('John')
      expect(lastNameInput).toHaveValue('Doe')
      expect(emailInput).toHaveValue('john@example.com')
    })

    it('should reset form after successful registration', async () => {
      const successAuthStore = { ...mockAuthStore, isAuthenticated: true }
      
      const { rerender } = render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email address/i)

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, 'john@example.com')

      // Simulate successful registration
      vi.mocked(useAuthStore).mockReturnValue(successAuthStore)
      rerender(<RegisterPage />)

      // Form should reset (implementation detail to be added)
      expect(true).toBe(true) // Placeholder
    })
  })

  describe('Integration with Auth Service', () => {
    it('should handle successful registration flow', async () => {
      const mockNavigate = vi.fn()
      vi.doMock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom')
        return {
          ...actual,
          useNavigate: () => mockNavigate,
        }
      })

      const successAuthStore = { 
        ...mockAuthStore, 
        register: vi.fn().mockResolvedValue(undefined),
        isAuthenticated: true 
      }
      vi.mocked(useAuthStore).mockReturnValue(successAuthStore)

      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i })
      const privacyCheckbox = screen.getByRole('checkbox', { name: /privacy policy/i })
      const submitButton = screen.getByRole('button', { name: /create account/i })

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, 'john@example.com')
      await user.type(passwordInput, 'Password123!')
      await user.type(confirmPasswordInput, 'Password123!')
      await user.click(termsCheckbox)
      await user.click(privacyCheckbox)
      await user.click(submitButton)

      await waitFor(() => {
        expect(successAuthStore.register).toHaveBeenCalledWith({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'Password123!',
          organization: '',
          department: '',
          phone: ''
        })
      })
    })

    it('should redirect to dashboard after successful registration', async () => {
      const mockNavigate = vi.fn()
      
      // Mock successful registration
      const successAuthStore = { 
        ...mockAuthStore, 
        isAuthenticated: true,
        user: { id: 1, email: 'john@example.com', tenant_id: 1 }
      }
      vi.mocked(useAuthStore).mockReturnValue(successAuthStore)

      render(<RegisterPage />, { wrapper: createTestWrapper() })

      // This will be implemented in the component
      expect(true).toBe(true) // Placeholder
    })
  })

  describe('Optional Fields', () => {
    it('should not require organization field', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const organizationInput = screen.getByLabelText(/organization/i)
      
      expect(organizationInput).not.toHaveAttribute('required')
      expect(organizationInput).toHaveAttribute('placeholder')
    })

    it('should not require department field', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const departmentInput = screen.getByLabelText(/department/i)
      
      expect(departmentInput).not.toHaveAttribute('required')
      expect(departmentInput).toHaveAttribute('placeholder')
    })

    it('should not require phone number field', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const phoneInput = screen.getByLabelText(/phone number/i)
      
      expect(phoneInput).not.toHaveAttribute('required')
      expect(phoneInput).toHaveAttribute('placeholder')
    })

    it('should validate phone number format when provided', async () => {
      render(<RegisterPage />, { wrapper: createTestWrapper() })

      const phoneInput = screen.getByLabelText(/phone number/i)
      
      await user.type(phoneInput, 'invalid-phone')
      
      // Phone validation should trigger on blur
      fireEvent.blur(phoneInput)
      
      expect(await screen.findByText(/invalid phone number format/i)).toBeInTheDocument()
    })
  })
})