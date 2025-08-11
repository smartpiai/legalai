/**
 * ResetPasswordPage Component
 * Password reset form with comprehensive validation, accessibility, and security features
 */
import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, CheckCircle } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { 
  resetPasswordSchema, 
  type ResetPasswordFormData, 
  calculatePasswordStrength,
  getPasswordStrengthColor,
  getPasswordStrengthWidth,
  type PasswordStrength
} from '@/schemas/auth.schema'
import { resetPassword } from '@/services/auth'
import { cn } from '@/utils/cn'

interface PasswordStrengthIndicatorProps {
  password: string
}

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password }) => {
  const strength = calculatePasswordStrength(password)
  const color = getPasswordStrengthColor(strength)
  const width = getPasswordStrengthWidth(strength)

  if (!password) return null

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600">Password strength</span>
        <span className={cn(
          "text-sm font-medium capitalize",
          strength === 'weak' && 'text-red-600',
          strength === 'medium' && 'text-yellow-600', 
          strength === 'strong' && 'text-green-600'
        )}>
          {strength}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          data-testid="password-strength-indicator"
          className={cn("h-2 rounded-full transition-all duration-300", color, width)}
        />
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
    setValue,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
    defaultValues: {
      token: '',
      password: '',
      confirmPassword: '',
    }
  })

  // Set token value once we have it
  useEffect(() => {
    if (token) {
      setValue('token', token)
    }
  }, [token, setValue])

  const watchedPassword = watch('password')

  // Redirect if no token
  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token')
      navigate('/forgot-password')
    }
  }, [token, navigate])

  // Clear errors when user starts typing
  useEffect(() => {
    if (error && watchedPassword) {
      setError(null)
    }
  }, [watchedPassword, error])

  // Auto-redirect after successful reset
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        navigate('/login', {
          state: { message: 'Password reset successful! Please log in with your new password.' }
        })
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isSuccess, navigate])

  // Cleanup sensitive data on unmount
  useEffect(() => {
    return () => {
      reset()
      setError(null)
    }
  }, [reset])

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setError('Invalid or missing reset token')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await resetPassword(token, data.password)
      setIsSuccess(true)
      reset() // Clear form data for security
    } catch (err: any) {
      const errorMessage = err.message || 'Password reset failed'
      
      // Handle specific error cases
      if (errorMessage.toLowerCase().includes('invalid') || errorMessage.toLowerCase().includes('expired')) {
        setError(errorMessage.includes('expired') ? 'Reset token has expired' : 'Invalid or expired reset token')
      } else if (errorMessage.toLowerCase().includes('network')) {
        setError('Network error. Please check your connection and try again.')
      } else {
        setError('Password reset failed. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Show error state if no token
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="mt-6 text-2xl md:text-3xl font-bold text-gray-900">
              Reset Password
            </h1>
            <div 
              className="mt-4 rounded-md bg-red-50 p-4 border border-red-200" 
              role="alert"
              aria-live="polite"
            >
              <div className="text-sm text-red-700">
                Invalid or missing reset token. Please request a new password reset link.
              </div>
            </div>
            <div className="mt-6">
              <Link 
                to="/forgot-password"
                className="font-medium text-blue-600 hover:text-blue-500 underline"
              >
                Request a new reset link
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show success state
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h1 className="mt-6 text-2xl md:text-3xl font-bold text-gray-900">
              Password Reset Successful
            </h1>
            <div 
              className="mt-4 rounded-md bg-green-50 p-4 border border-green-200" 
              role="alert"
              aria-live="polite"
            >
              <div className="text-sm text-green-700">
                Your password has been successfully reset. You will be redirected to the login page shortly.
              </div>
            </div>
            <div className="mt-6">
              <Link 
                to="/login"
                className="font-medium text-blue-600 hover:text-blue-500 underline"
              >
                Sign in now
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="mt-6 text-center text-2xl md:text-3xl font-bold text-gray-900">
            Reset Password
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your new password below
          </p>
        </div>

        <form 
          className="mt-8 space-y-6" 
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          role="form"
          aria-label="Password reset form"
        >
          {/* Hidden token field */}
          <input
            type="hidden"
            {...register('token')}
            value={token}
          />

          {/* Error display */}
          {error && (
            <div 
              className="rounded-md bg-red-50 p-4 border border-red-200" 
              role="alert"
              aria-live="polite"
            >
              <div className="text-sm text-red-700">
                {error}
                {error.toLowerCase().includes('expired') && (
                  <div className="mt-2">
                    <Link 
                      to="/forgot-password"
                      className="font-medium text-blue-600 hover:text-blue-500 underline"
                    >
                      Request a new reset link
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Password Fields */}
          <fieldset className="space-y-4" role="group" aria-labelledby="password-info-legend">
            <legend id="password-info-legend" className="sr-only">Password Information</legend>
            
            <div className="relative">
              <Input
                {...register('password')}
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                required
                disabled={isLoading}
                error={errors.password?.message}
                placeholder="Enter your new password"
                autoComplete="new-password"
                aria-label="Enter your new password"
                autoFocus
              />
              <button
                type="button"
                className="absolute right-3 top-8 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
                <span className="sr-only">
                  {showPassword ? 'Hide password' : 'Show password'}
                </span>
              </button>
              
              {watchedPassword && <PasswordStrengthIndicator password={watchedPassword} />}
            </div>

            <div className="relative">
              <Input
                {...register('confirmPassword')}
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                disabled={isLoading}
                error={errors.confirmPassword?.message}
                placeholder="Confirm your new password"
                autoComplete="new-password"
                aria-label="Confirm your new password"
              />
              <button
                type="button"
                className="absolute right-3 top-8 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
                aria-pressed={showConfirmPassword}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
                <span className="sr-only">
                  {showConfirmPassword ? 'Hide password' : 'Show password'}
                </span>
              </button>
            </div>
          </fieldset>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            disabled={isLoading}
            className="mt-6"
          >
            {isLoading ? 'Resetting Password...' : 'Reset Password'}
          </Button>

          {/* Back to Login Link */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Remember your password?{' '}
              <Link 
                to="/login" 
                className="font-medium text-blue-600 hover:text-blue-500 underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}