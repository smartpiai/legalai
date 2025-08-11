/**
 * Authentication Form Validation Schemas
 * Using Zod for runtime validation with TypeScript inference
 */

import { z } from 'zod'

/**
 * Login form validation schema
 * Validates email and password fields with security requirements
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(254, 'Email is too long') // RFC 5321 limit
    .toLowerCase()
    .trim(),
  
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'), // Prevent DoS attacks
  
  rememberMe: z.boolean().default(false).optional(),
})

/**
 * Register form validation schema
 * Includes additional fields for user registration
 */
export const registerSchema = z
  .object({
    firstName: z
      .string()
      .min(1, 'First name is required')
      .min(2, 'First name must be at least 2 characters')
      .max(50, 'First name is too long')
      .trim()
      .transform(val => val.replace(/[<>]/g, '')), // Basic XSS protection
    
    lastName: z
      .string()
      .min(1, 'Last name is required')
      .min(2, 'Last name must be at least 2 characters')
      .max(50, 'Last name is too long')
      .trim()
      .transform(val => val.replace(/[<>]/g, '')), // Basic XSS protection
    
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .max(254, 'Email is too long')
      .toLowerCase()
      .trim(),
    
    password: z
      .string()
      .min(1, 'Password is required')
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password is too long')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain uppercase, lowercase, number, and special character'
      ),
    
    confirmPassword: z
      .string()
      .min(1, 'Please confirm your password'),
    
    organization: z
      .string()
      .max(100, 'Organization name is too long')
      .trim()
      .transform(val => val.replace(/[<>]/g, ''))
      .optional()
      .default(''),
    
    department: z
      .string()
      .max(100, 'Department name is too long')
      .trim()
      .transform(val => val.replace(/[<>]/g, ''))
      .optional()
      .default(''),
    
    phone: z
      .string()
      .regex(
        /^(\+?\d{1,4}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}$/,
        'Invalid phone number format'
      )
      .or(z.literal(''))
      .optional()
      .default(''),
    
    acceptTerms: z
      .boolean()
      .refine(val => val === true, 'You must accept the terms of service'),
    
    acceptPrivacy: z
      .boolean()
      .refine(val => val === true, 'You must accept the privacy policy'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

/**
 * Forgot password form validation schema
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(254, 'Email is too long')
    .toLowerCase()
    .trim(),
})

/**
 * Reset password form validation schema
 */
export const resetPasswordSchema = z
  .object({
    token: z
      .string()
      .min(1, 'Reset token is required'),
    
    password: z
      .string()
      .min(1, 'Password is required')
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password is too long')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain uppercase, lowercase, number, and special character'
      ),
    
    confirmPassword: z
      .string()
      .min(1, 'Please confirm your password'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

/**
 * Change password form validation schema
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Current password is required'),
    
    newPassword: z
      .string()
      .min(1, 'New password is required')
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password is too long')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain uppercase, lowercase, number, and special character'
      ),
    
    confirmPassword: z
      .string()
      .min(1, 'Please confirm your new password'),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine(data => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  })

// Type exports for TypeScript inference
export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>

// Common validation messages for consistency
export const validationMessages = {
  required: {
    email: 'Email is required',
    password: 'Password is required',
    fullName: 'Full name is required',
    currentPassword: 'Current password is required',
    newPassword: 'New password is required',
    confirmPassword: 'Please confirm your password',
  },
  invalid: {
    email: 'Invalid email format',
    passwordFormat: 'Password must contain uppercase, lowercase, number, and special character',
    passwordMatch: 'Passwords do not match',
    passwordSame: 'New password must be different from current password',
  },
  limits: {
    emailTooLong: 'Email is too long',
    passwordTooShort: 'Password must be at least 8 characters',
    passwordTooLong: 'Password is too long',
    nameTooLong: 'Name is too long',
    companyTooLong: 'Company name is too long',
  },
  business: {
    acceptTerms: 'You must accept the terms and conditions',
  },
} as const

// Helper functions for common validation patterns
export const validateEmail = (email: string): boolean => {
  return z.string().email().safeParse(email).success
}

export const validatePassword = (password: string): boolean => {
  return loginSchema.shape.password.safeParse(password).success
}

export const validateStrongPassword = (password: string): boolean => {
  return registerSchema.shape.password.safeParse(password).success
}

// Password strength calculation
export type PasswordStrength = 'weak' | 'medium' | 'strong'

export const calculatePasswordStrength = (password: string): PasswordStrength => {
  if (!password || password.length < 8) return 'weak'
  
  const hasLowercase = /[a-z]/.test(password)
  const hasUppercase = /[A-Z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecial = /[@$!%*?&]/.test(password)
  
  const criteriaCount = [hasLowercase, hasUppercase, hasNumber, hasSpecial].filter(Boolean).length
  
  if (password.length >= 12 && criteriaCount === 4) return 'strong'
  if (password.length >= 8 && criteriaCount >= 3) return 'medium'
  
  return 'weak'
}

export const getPasswordStrengthColor = (strength: PasswordStrength): string => {
  switch (strength) {
    case 'weak': return 'bg-red-500'
    case 'medium': return 'bg-yellow-500'
    case 'strong': return 'bg-green-500'
    default: return 'bg-gray-300'
  }
}

export const getPasswordStrengthWidth = (strength: PasswordStrength): string => {
  switch (strength) {
    case 'weak': return 'w-1/3'
    case 'medium': return 'w-2/3'
    case 'strong': return 'w-full'
    default: return 'w-0'
  }
}

/**
 * Profile update form validation schema
 */
export const profileUpdateSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name is too long')
    .trim()
    .transform(val => val.replace(/[<>]/g, '')),
  
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name is too long')
    .trim()
    .transform(val => val.replace(/[<>]/g, '')),
  
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(254, 'Email is too long')
    .toLowerCase()
    .trim(),
  
  phone: z
    .string()
    .regex(
      /^(\+?\d{1,4}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}$/,
      'Invalid phone number format'
    )
    .or(z.literal(''))
    .optional()
    .default(''),
  
  department: z
    .string()
    .max(100, 'Department name is too long')
    .trim()
    .transform(val => val.replace(/[<>]/g, ''))
    .optional()
    .default(''),
  
  title: z
    .string()
    .max(100, 'Title is too long')
    .trim()
    .transform(val => val.replace(/[<>]/g, ''))
    .optional()
    .default(''),
  
  organization: z
    .string()
    .max(100, 'Organization name is too long')
    .trim()
    .transform(val => val.replace(/[<>]/g, ''))
    .optional()
    .default(''),
})

/**
 * Preferences update schema
 */
export const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  language: z.enum(['en', 'es', 'fr', 'de']).default('en'),
  timezone: z.string().default('UTC'),
  emailNotifications: z.boolean().default(true),
  browserNotifications: z.boolean().default(true),
  contractUpdates: z.boolean().default(true),
  marketingEmails: z.boolean().default(false),
})

/**
 * Security settings schema
 */
export const securitySettingsSchema = z.object({
  twoFactorEnabled: z.boolean().default(false),
  sessionTimeout: z.number().min(5).max(1440).default(60), // Minutes
})

/**
 * Password confirmation schema for sensitive changes
 */
export const passwordConfirmationSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Current password is required to confirm this change'),
})

// Type exports for new schemas
export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>
export type PreferencesFormData = z.infer<typeof preferencesSchema>
export type SecuritySettingsFormData = z.infer<typeof securitySettingsSchema>
export type PasswordConfirmationFormData = z.infer<typeof passwordConfirmationSchema>

// Theme options for UI
export const themeOptions = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const

// Language options for UI
export const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
] as const

// Common timezone options (subset for demo)
export const timezoneOptions = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
] as const