/**
 * LoginPage Component - GREEN Phase Implementation
 * Minimal implementation to pass TDD tests
 * 
 * Features:
 * - Form validation with Zod schema
 * - Integration with auth store
 * - Loading states and error handling
 * - Password visibility toggle
 * - Remember me functionality
 * - Accessibility compliance
 * - Security features
 * - Navigation links
 */

import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'

import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuthStore } from '@/store/auth'
import { loginSchema, type LoginFormData } from '@/schemas/auth.schema'
import { cn } from '@/utils/cn'

export default function LoginPage() {
  const navigate = useNavigate()
  const emailInputRef = useRef<HTMLInputElement>(null)
  
  // Auth store
  const { login, isLoading, error, isAuthenticated, setError } = useAuthStore()
  
  // Local state
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  // Form setup with Zod validation
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
    clearErrors,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  })

  // Watch form values for clearing errors
  const watchedValues = watch()

  // Focus email input on mount
  useEffect(() => {
    emailInputRef.current?.focus()
  }, [])

  // Clear error when user starts typing
  useEffect(() => {
    if (error && (watchedValues.email || watchedValues.password)) {
      setError(null)
    }
  }, [watchedValues.email, watchedValues.password, error, setError])

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  // Clean up sensitive data on unmount
  useEffect(() => {
    return () => {
      reset()
    }
  }, [reset])

  // Form submission handler
  const onSubmit = async (data: LoginFormData) => {
    try {
      clearErrors()
      await login(data.email, data.password)
      
      // Reset form after successful login
      reset()
      
      // Navigation is handled by the auth store/redirect effect
    } catch (err) {
      // Error is handled by auth store
      console.error('Login error:', err)
    }
  }

  // Password visibility toggle
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  // Handle keyboard navigation for password toggle
  const handleToggleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      togglePasswordVisibility()
    }
  }

  // Clear error on input focus
  const handleInputChange = () => {
    if (error) {
      setError(null)
    }
  }

  const isFormDisabled = isLoading || isSubmitting

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle as="h1" className="text-2xl sm:text-3xl md:text-2xl font-bold">
            Sign In
          </CardTitle>
          <p className="text-sm text-gray-600">
            Enter your credentials to access your account
          </p>
        </CardHeader>
        
        <CardContent>
          <form 
            role="form" 
            onSubmit={handleSubmit(onSubmit)} 
            className="space-y-4"
            noValidate
          >
            {/* Error Message Display */}
            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md"
              >
                {error}
              </div>
            )}

            {/* Email Input */}
            <div>
              <Input
                {...register('email')}
                ref={emailInputRef}
                type="email"
                label="Email Address"
                placeholder="Enter your email"
                disabled={isFormDisabled}
                error={errors.email?.message}
                required
                autoComplete="email"
                aria-label="Email address"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                onChange={(e) => {
                  const { onChange } = register('email')
                  onChange(e)
                  handleInputChange()
                }}
                className={cn(
                  "w-full",
                  errors.email && "border-red-500 focus:border-red-500 focus:ring-red-500"
                )}
              />
            </div>

            {/* Password Input with Toggle */}
            <div className="relative">
              <Input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                label="Password"
                placeholder="Enter your password"
                disabled={isFormDisabled}
                error={errors.password?.message}
                required
                autoComplete="current-password"
                aria-label="Password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                onChange={(e) => {
                  const { onChange } = register('password')
                  onChange(e)
                  handleInputChange()
                }}
                className={cn(
                  "w-full pr-10",
                  errors.password && "border-red-500 focus:border-red-500 focus:ring-red-500"
                )}
              />
              
              {/* Password Toggle Button */}
              <button
                type="button"
                onClick={togglePasswordVisibility}
                onKeyDown={handleToggleKeyDown}
                disabled={isFormDisabled}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 pt-6"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                )}
              </button>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isFormDisabled}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
              />
              <label 
                htmlFor="remember-me" 
                className="ml-2 block text-sm text-gray-700"
              >
                Remember me
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              fullWidth
              loading={isLoading}
              disabled={isFormDisabled}
              variant="primary"
              size="md"
              className="w-full"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>

            {/* Navigation Links */}
            <div className="space-y-2 text-center">
              <Link
                to="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              >
                Forgot Password?
              </Link>
              
              <div className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                >
                  Create Account
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}