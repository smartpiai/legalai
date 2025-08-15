/**
 * RegisterPage Component
 * User registration form with comprehensive validation, accessibility, and security features
 */
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/auth'
import { 
  registerSchema, 
  type RegisterFormData, 
  calculatePasswordStrength,
  getPasswordStrengthColor,
  getPasswordStrengthWidth,
  type PasswordStrength
} from '@/schemas/auth.schema'
import { cn } from '@/lib/utils'

interface PasswordStrengthIndicatorProps {
  password: string
}

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password }) => {
  const strength = calculatePasswordStrength(password)
  const color = getPasswordStrengthColor(strength)
  const width = getPasswordStrengthWidth(strength)

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

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register: registerUser, isLoading, error, setError, isAuthenticated } = useAuthStore()
  
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
    reset,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      organization: '',
      department: '',
      phone: '',
      acceptTerms: false,
      acceptPrivacy: false,
    }
  })

  const watchedPassword = watch('password')
  const watchedTerms = watch('acceptTerms')
  const watchedPrivacy = watch('acceptPrivacy')

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  // Clear errors when user starts typing
  useEffect(() => {
    if (error && watchedPassword) {
      setError(null)
    }
  }, [watchedPassword, error, setError])

  // Cleanup sensitive data on unmount
  useEffect(() => {
    return () => {
      reset()
    }
  }, [reset])

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        organization: data.organization || '',
        department: data.department || '',
        phone: data.phone || ''
      })
    } catch (err) {
      // Error is handled by the auth store
      console.error('Registration failed:', err)
    }
  }

  const isFormDisabled = isLoading || !watchedTerms || !watchedPrivacy

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Create Account
        </h1>
        <p className="text-sm text-muted-foreground">
          Join the Legal AI Platform to get started
        </p>
      </div>

      {/* Registration Form */}
      <form 
        className="space-y-6" 
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        role="form"
        aria-label="Registration form"
      >
          {/* Error display */}
          {error && (
            <div 
              className="rounded-md bg-destructive/10 p-4 border border-destructive/20" 
              role="alert"
              aria-live="polite"
            >
              <div className="text-sm text-destructive">{error}</div>
            </div>
          )}

          {/* Personal Information */}
          <fieldset className="space-y-4" role="group" aria-labelledby="personal-info-legend">
            <legend id="personal-info-legend" className="sr-only">Personal Information</legend>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                {...register('firstName')}
                label="First Name"
                type="text"
                required
                disabled={isLoading}
                error={errors.firstName?.message}
                placeholder="Enter your first name"
                autoComplete="given-name"
                aria-label="Enter your first name"
                autoFocus
              />

              <Input
                {...register('lastName')}
                label="Last Name"
                type="text"
                required
                disabled={isLoading}
                error={errors.lastName?.message}
                placeholder="Enter your last name"
                autoComplete="family-name"
                aria-label="Enter your last name"
              />
            </div>

            <Input
              {...register('email')}
              label="Email Address"
              type="email"
              required
              disabled={isLoading}
              error={errors.email?.message}
              placeholder="Enter your email address"
              autoComplete="email"
              aria-label="Enter your email address"
            />
          </fieldset>

          {/* Password Fields */}
          <fieldset className="space-y-4" role="group" aria-labelledby="password-info-legend">
            <legend id="password-info-legend" className="sr-only">Password Information</legend>
            
            <div>
              <Input
                {...register('password')}
                label="Password"
                type={showPassword ? 'text' : 'password'}
                required
                disabled={isLoading}
                error={errors.password?.message}
                placeholder="Create a strong password"
                autoComplete="new-password"
                aria-label="Create a strong password"
              />
              <button
                type="button"
                className="absolute mt-2 right-2 top-8 flex items-center text-sm"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
              
              {watchedPassword && <PasswordStrengthIndicator password={watchedPassword} />}
            </div>

            <div>
              <Input
                {...register('confirmPassword')}
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                disabled={isLoading}
                error={errors.confirmPassword?.message}
                placeholder="Confirm your password"
                autoComplete="new-password"
                aria-label="Confirm your password"
              />
              <button
                type="button"
                className="absolute mt-2 right-2 top-8 flex items-center text-sm"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
                aria-pressed={showConfirmPassword}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </fieldset>

          {/* Optional Information */}
          <fieldset className="space-y-4" role="group" aria-labelledby="optional-info-legend">
            <legend id="optional-info-legend" className="sr-only">Optional Information</legend>
            
            <Input
              {...register('organization')}
              label="Organization"
              type="text"
              disabled={isLoading}
              error={errors.organization?.message}
              placeholder="Company or organization (optional)"
              autoComplete="organization"
              aria-label="Company or organization (optional)"
            />

            <Input
              {...register('department')}
              label="Department"
              type="text"
              disabled={isLoading}
              error={errors.department?.message}
              placeholder="Department or team (optional)"
              aria-label="Department or team (optional)"
            />

            <Input
              {...register('phone')}
              label="Phone Number"
              type="tel"
              disabled={isLoading}
              error={errors.phone?.message}
              placeholder="Phone number (optional)"
              autoComplete="tel"
              aria-label="Phone number (optional)"
            />
          </fieldset>

          {/* Terms and Privacy */}
          <fieldset className="space-y-3" role="group" aria-labelledby="terms-legend">
            <legend id="terms-legend" className="sr-only">Terms and Conditions</legend>
            
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  {...register('acceptTerms')}
                  id="accept-terms"
                  type="checkbox"
                  disabled={isLoading}
                  className="focus:ring-ring h-4 w-4 text-primary border-input rounded disabled:opacity-50"
                  aria-describedby={errors.acceptTerms ? 'terms-error' : undefined}
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="accept-terms" className="text-gray-700">
                  I agree to the{' '}
                  <Link 
                    to="/terms" 
                    className="text-primary hover:text-primary/80 underline underline-offset-4"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Terms of Service
                  </Link>
                  <span className="text-red-500 ml-1">*</span>
                </label>
                {errors.acceptTerms && (
                  <p id="terms-error" className="text-red-600 text-sm mt-1" role="alert" aria-live="polite">
                    {errors.acceptTerms.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  {...register('acceptPrivacy')}
                  id="accept-privacy"
                  type="checkbox"
                  disabled={isLoading}
                  className="focus:ring-ring h-4 w-4 text-primary border-input rounded disabled:opacity-50"
                  aria-describedby={errors.acceptPrivacy ? 'privacy-error' : undefined}
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="accept-privacy" className="text-gray-700">
                  I agree to the{' '}
                  <Link 
                    to="/privacy" 
                    className="text-primary hover:text-primary/80 underline underline-offset-4"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Privacy Policy
                  </Link>
                  <span className="text-red-500 ml-1">*</span>
                </label>
                {errors.acceptPrivacy && (
                  <p id="privacy-error" className="text-red-600 text-sm mt-1" role="alert" aria-live="polite">
                    {errors.acceptPrivacy.message}
                  </p>
                )}
              </div>
            </div>
          </fieldset>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="default"
            size="lg"
            fullWidth
            loading={isLoading}
            disabled={isFormDisabled}
            className="mt-6"
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Button>

          {/* Login Link */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link 
                to="/login" 
                className="font-medium text-primary hover:text-primary/80 underline underline-offset-4"
              >
                Sign in
              </Link>
            </p>
        </div>
      </form>
    </div>
  )
}