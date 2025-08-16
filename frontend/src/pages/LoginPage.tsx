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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useAuthStore } from '@/store/auth'
import { loginSchema, type LoginFormData } from '@/schemas/auth.schema'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const navigate = useNavigate()
  const emailInputRef = useRef<HTMLInputElement>(null)
  
  // Auth store
  const { login, isLoading, error, isAuthenticated, setError } = useAuthStore()
  
  // Local state
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  // Form setup with Zod validation
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  })

  const { handleSubmit, formState: { errors, isSubmitting }, watch, reset, clearErrors } = form

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
      navigate('/', { replace: true })
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
    <div className="flex flex-col flex-1">
      {/* Back Link */}
      <div className="w-full max-w-md pt-10 mx-auto lg:hidden">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          ← Back to dashboard
        </Link>
      </div>

      {/* Main Content */}
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        {/* Header */}
        <div className="mb-5 sm:mb-8">
          <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
            Sign In
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enter your credentials to access your legal workspace
          </p>
        </div>

        {/* Social Login Buttons */}
        <div className="grid grid-cols-1 gap-3 mb-5 sm:grid-cols-2 sm:gap-5">
          <button className="inline-flex items-center justify-center gap-3 py-3 text-sm font-normal text-gray-700 transition-colors bg-gray-100 rounded-lg px-7 hover:bg-gray-200 hover:text-gray-800 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>
          <button className="inline-flex items-center justify-center gap-3 py-3 text-sm font-normal text-gray-700 transition-colors bg-gray-100 rounded-lg px-7 hover:bg-gray-200 hover:text-gray-800 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M13.54 12a6.8 6.8 0 01-2.06 4.94l-.02.02-.02.02c-2.72 2.71-7.15 2.71-9.87 0s-2.71-7.15 0-9.87l.02-.02.02-.02a6.8 6.8 0 014.87-2.01c1.65 0 3.29.63 4.54 1.88 .18.18.35.37.52.57l1.76-1.76-.52-.57C11.15 2.45 8.85 1.5 6.46 1.5c-2.69 0-5.22 1.05-7.12 2.95C-1.05 5.83-1.05 10.17.84 12.55c1.89 1.89 4.42 2.95 7.12 2.95s5.23-1.06 7.12-2.95c.22-.22.43-.45.63-.69l-2.17-2.17c-.2.24-.42.47-.64.69z"/>
            </svg>
            Microsoft
          </button>
        </div>

        {/* Divider */}
        <div className="relative py-3 mb-5 sm:py-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="p-2 text-gray-400 bg-white dark:bg-gray-900 sm:px-5 sm:py-2">
              Or
            </span>
          </div>
        </div>

        {/* Login Form */}
        <Form {...form}>
          <form 
            onSubmit={handleSubmit(onSubmit)} 
            className="space-y-6"
            noValidate
          >
            {/* Error Message Display */}
            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="p-4 text-sm text-error-700 bg-error-50 border border-error-200 rounded-lg dark:text-error-400 dark:bg-error-500/10 dark:border-error-500/20"
              >
                {error}
              </div>
            )}

          {/* Email Field */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    disabled={isFormDisabled}
                    autoComplete="email"
                    {...field}
                    ref={(el) => {
                      field.ref(el)
                      emailInputRef.current = el
                    }}
                    onChange={(e) => {
                      field.onChange(e)
                      handleInputChange()
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password Field */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      disabled={isFormDisabled}
                      autoComplete="current-password"
                      className="pr-10"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        handleInputChange()
                      }}
                    />
                    
                    {/* Password Toggle Button */}
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      onKeyDown={handleToggleKeyDown}
                      disabled={isFormDisabled}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

            {/* Submit Button */}
            <Button
              type="submit"
              loading={isLoading}
              disabled={isFormDisabled}
              variant="primary"
              size="sm"
              className="w-full"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>

            {/* Navigation Links */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isFormDisabled}
                  className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded disabled:opacity-50"
                />
                <label 
                  htmlFor="remember-me" 
                  className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400 cursor-pointer"
                >
                  Keep me logged in
                </label>
              </div>
              <Link
                to="/forgot-password"
                className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          </form>
        </Form>

        {/* Sign Up Link */}
        <div className="mt-5">
          <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-brand-500 hover:text-brand-600 dark:text-brand-400 font-medium transition-colors"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
