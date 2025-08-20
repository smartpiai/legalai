/**
 * RegisterPage with Dashboard Styling
 * Professional registration form following TailAdmin patterns
 */
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function RegisterPageDashboard() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    organization: '',
    acceptTerms: false,
    acceptPrivacy: false,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName) {
      setError('Please fill in all required fields')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!formData.acceptTerms || !formData.acceptPrivacy) {
      setError('Please accept the terms and privacy policy')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          username: formData.email.split('@')[0], // Generate username from email
          password: formData.password,
          confirm_password: formData.confirmPassword,
          full_name: `${formData.firstName} ${formData.lastName}`,
        }),
      })
      
      if (response.ok) {
        navigate('/dashboard')
      } else {
        const errorData = await response.json()
        // Handle validation errors properly
        if (Array.isArray(errorData.detail)) {
          const firstError = errorData.detail[0]
          setError(firstError.msg || 'Registration failed')
        } else {
          setError(errorData.detail || 'Registration failed')
        }
      }
    } catch (err) {
      setError('Network error occurred')
      console.error('Registration error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) {
      setError(null)
    }
  }

  const isFormDisabled = isLoading || !formData.acceptTerms || !formData.acceptPrivacy

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
            Create Account
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Join the Legal AI Platform to streamline your legal operations
          </p>
        </div>

        {/* Registration Form */}
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

          {/* Name Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                First Name <span className="text-error-500">*</span>
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder="Enter your first name"
                disabled={isLoading}
                required
                autoComplete="given-name"
                className="h-11 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-gray-100 dark:bg-gray-900 dark:border-gray-700 dark:text-white/90 dark:placeholder:text-white/30 dark:disabled:bg-gray-800 dark:focus:border-brand-800"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                Last Name <span className="text-error-500">*</span>
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder="Enter your last name"
                disabled={isLoading}
                required
                autoComplete="family-name"
                className="h-11 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-gray-100 dark:bg-gray-900 dark:border-gray-700 dark:text-white/90 dark:placeholder:text-white/30 dark:disabled:bg-gray-800 dark:focus:border-brand-800"
              />
            </div>
          </div>

          {/* Email Field */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
              Email Address <span className="text-error-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="Enter your email address"
              disabled={isLoading}
              required
              autoComplete="email"
              className="h-11 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-gray-100 dark:bg-gray-900 dark:border-gray-700 dark:text-white/90 dark:placeholder:text-white/30 dark:disabled:bg-gray-800 dark:focus:border-brand-800"
            />
          </div>

          {/* Password Fields */}
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                Password <span className="text-error-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Create a strong password"
                  disabled={isLoading}
                  required
                  autoComplete="new-password"
                  className="h-11 w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-12 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-gray-100 dark:bg-gray-900 dark:border-gray-700 dark:text-white/90 dark:placeholder:text-white/30 dark:disabled:bg-gray-800 dark:focus:border-brand-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 text-sm"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                Confirm Password <span className="text-error-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  placeholder="Confirm your password"
                  disabled={isLoading}
                  required
                  autoComplete="new-password"
                  className="h-11 w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-12 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-gray-100 dark:bg-gray-900 dark:border-gray-700 dark:text-white/90 dark:placeholder:text-white/30 dark:disabled:bg-gray-800 dark:focus:border-brand-800"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 text-sm"
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>

          {/* Organization Field */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
              Organization
            </label>
            <input
              type="text"
              value={formData.organization}
              onChange={(e) => handleInputChange('organization', e.target.value)}
              placeholder="Company or organization (optional)"
              disabled={isLoading}
              autoComplete="organization"
              className="h-11 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-gray-100 dark:bg-gray-900 dark:border-gray-700 dark:text-white/90 dark:placeholder:text-white/30 dark:disabled:bg-gray-800 dark:focus:border-brand-800"
            />
          </div>

          {/* Terms and Privacy */}
          <div className="space-y-3">
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="accept-terms"
                  type="checkbox"
                  checked={formData.acceptTerms}
                  onChange={(e) => handleInputChange('acceptTerms', e.target.checked)}
                  disabled={isLoading}
                  className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded disabled:opacity-50"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="accept-terms" className="text-gray-700 dark:text-gray-400">
                  I agree to the{' '}
                  <Link 
                    to="/terms" 
                    className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Terms of Service
                  </Link>
                  <span className="text-error-500 ml-1">*</span>
                </label>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="accept-privacy"
                  type="checkbox"
                  checked={formData.acceptPrivacy}
                  onChange={(e) => handleInputChange('acceptPrivacy', e.target.checked)}
                  disabled={isLoading}
                  className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded disabled:opacity-50"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="accept-privacy" className="text-gray-700 dark:text-gray-400">
                  I agree to the{' '}
                  <Link 
                    to="/privacy" 
                    className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Privacy Policy
                  </Link>
                  <span className="text-error-500 ml-1">*</span>
                </label>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isFormDisabled}
            className="w-full bg-brand-500 text-white shadow-sm hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-50 px-5 py-3.5 text-sm h-12 rounded-lg font-medium transition-colors inline-flex items-center justify-center gap-2"
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        {/* Sign In Link */}
        <div className="mt-5">
          <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-brand-500 hover:text-brand-600 dark:text-brand-400 font-medium transition-colors"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}