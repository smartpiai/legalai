/**
 * LoginPage with Dashboard Styling
 * Professional login form following TailAdmin patterns
 */
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function LoginPageDashboard() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      setError('Please enter both email and password')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Test API call
      const response = await fetch('http://192.168.1.4:18001/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: email,
          password: password,
        }),
      })
      
      if (response.ok) {
        navigate('/dashboard')
      } else {
        const errorData = await response.json()
        // Handle validation errors properly
        if (Array.isArray(errorData.detail)) {
          const firstError = errorData.detail[0]
          setError(firstError.msg || 'Login failed')
        } else {
          setError(errorData.detail || 'Login failed')
        }
      }
    } catch (err) {
      setError('Network error occurred')
      console.error('Login error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = () => {
    if (error) {
      setError(null)
    }
  }

  const isFormDisabled = isLoading

  return (
    <div className="flex flex-col flex-1">
      {/* Back Link (Mobile) */}
      <div className="w-full max-w-md pt-10 mx-auto lg:hidden">
        <Link
          to="/dashboard"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          ← Back to dashboard
        </Link>
      </div>

      {/* Main Content */}
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        {/* Header */}
        <div className="mb-5 sm:mb-8">
          <h1 className="mb-2 font-semibold text-gray-800 text-3xl dark:text-white/90 sm:text-4xl font-outfit">
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
            Sign in with Google
          </button>
          <button className="inline-flex items-center justify-center gap-3 py-3 text-sm font-normal text-gray-700 transition-colors bg-gray-100 rounded-lg px-7 hover:bg-gray-200 hover:text-gray-800 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M19.27 5.33C17.94 4.04 16.06 3.27 14 3.27c-3.75 0-6.98 2.87-7.39 6.55h2.92c.36-2.13 2.26-3.82 4.47-3.82 1.18 0 2.27.48 3.06 1.25l2.21-2.21z"/>
              <path d="M6.61 9.82c-.05.38-.08.77-.08 1.18s.03.8.08 1.18H3.69c-.16-.77-.25-1.56-.25-2.36s.09-1.59.25-2.36h2.92z"/>
              <path d="M14 16.73c-2.21 0-4.11-1.69-4.47-3.82H6.61c.41 3.68 3.64 6.55 7.39 6.55 2.06 0 3.94-.77 5.27-2.04l-2.21-2.21c-.79.77-1.88 1.25-3.06 1.25z"/>
              <path d="M20.27 10.73H14v2.36h3.64c-.75 2.03-2.75 3.46-5.14 3.46v2.36c3.75 0 6.98-2.87 7.39-6.55h-2.92z"/>
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
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Display */}
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
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
              Email <span className="text-error-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                handleInputChange()
              }}
              placeholder="Enter your email"
              disabled={isFormDisabled}
              required
              autoComplete="email"
              className="h-11 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-gray-100 dark:bg-gray-900 dark:border-gray-700 dark:text-white/90 dark:placeholder:text-white/30 dark:disabled:bg-gray-800 dark:focus:border-brand-800"
            />
          </div>

          {/* Password Field */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
              Password <span className="text-error-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  handleInputChange()
                }}
                placeholder="Enter your password"
                disabled={isFormDisabled}
                required
                autoComplete="current-password"
                className="h-11 w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-12 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-gray-100 dark:bg-gray-900 dark:border-gray-700 dark:text-white/90 dark:placeholder:text-white/30 dark:disabled:bg-gray-800 dark:focus:border-brand-800"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isFormDisabled}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 text-sm cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
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
                className="block font-normal text-gray-700 text-sm dark:text-gray-400 cursor-pointer"
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isFormDisabled}
            className="w-full bg-brand-500 text-white shadow-sm hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-50 px-5 py-3.5 text-sm h-12 rounded-lg font-medium transition-colors inline-flex items-center justify-center gap-2"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

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