/**
 * Input component with validation states and accessibility
 * Core form input for the Legal AI Platform
 */
import React, { forwardRef, InputHTMLAttributes, useId } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string
  error?: string
  helperText?: string
  success?: boolean
  prefix?: string | React.ReactNode
  suffix?: string | React.ReactNode
  icon?: React.ReactNode
  clearable?: boolean
  containerClassName?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      success,
      prefix,
      suffix,
      icon,
      clearable,
      className,
      containerClassName,
      required,
      disabled,
      readOnly,
      name,
      id: providedId,
      onChange,
      value,
      type = 'text',
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = providedId || name || generatedId
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`

    const handleClear = () => {
      if (onChange && !disabled) {
        const event = {
          target: {
            name: name || '',
            value: '',
          },
        } as React.ChangeEvent<HTMLInputElement>
        onChange(event)
      }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!disabled && onChange) {
        onChange(e)
      }
    }

    const inputClasses = cn(
      'h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs transition-colors',
      'placeholder:text-gray-400 dark:placeholder:text-white/30',
      'focus:outline-none focus:ring-3 focus:ring-brand-500/20',
      'disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-gray-100 dark:disabled:bg-gray-800',
      'dark:bg-gray-900 dark:text-white/90',
      {
        'bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 dark:border-gray-700 dark:text-white/90 dark:focus:border-brand-800': !error && !success,
        'border-error-500 focus:border-error-300 focus:ring-error-500/20 dark:text-error-400 dark:border-error-500 dark:focus:border-error-800': error,
        'border-success-500 focus:border-success-300 focus:ring-success-500/20 dark:text-success-400 dark:border-success-500 dark:focus:border-success-800': success,
        'pl-10': icon,
        'pl-8': prefix && !icon,
        'pr-8': suffix || clearable,
      },
      className
    )

    const containerClasses = cn('relative', containerClassName)

    const describedBy = [
      error && errorId,
      helperText && helperId,
    ].filter(Boolean).join(' ') || undefined

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
          >
            {label}
            {required && <span className="ml-1 text-error-500">*</span>}
          </label>
        )}
        
        <div className={containerClasses}>
          {icon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {icon}
            </div>
          )}
          
          {prefix && !icon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
              {prefix}
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            name={name}
            type={type}
            value={value}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            className={inputClasses}
            aria-invalid={!!error}
            aria-required={required}
            aria-describedby={describedBy}
            onChange={handleChange}
            {...props}
          />
          
          {clearable && value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
              aria-label="Clear input"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          
          {suffix && !clearable && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
              {suffix}
            </div>
          )}
        </div>
        
        {error && (
          <p id={errorId} className="mt-1 text-sm text-destructive">
            {error}
          </p>
        )}
        
        {helperText && !error && (
          <p id={helperId} className="mt-1 text-sm text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'