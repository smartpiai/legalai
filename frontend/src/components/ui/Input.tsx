/**
 * Input component with validation states and accessibility
 * Core form input for the Legal AI Platform
 */
import React, { forwardRef, InputHTMLAttributes, useId } from 'react'
import { cn } from '@/utils/cn'
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
      'flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm ring-offset-white transition-colors',
      'file:border-0 file:bg-transparent file:text-sm file:font-medium',
      'placeholder:text-gray-500',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      {
        'border-gray-300 focus-visible:ring-blue-500': !error && !success,
        'border-red-500 focus-visible:ring-red-500': error,
        'border-green-500 focus-visible:ring-green-500': success,
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
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            {label}
            {required && <span className="ml-1 text-red-500">*</span>}
          </label>
        )}
        
        <div className={containerClasses}>
          {icon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {icon}
            </div>
          )}
          
          {prefix && !icon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
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
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              aria-label="Clear input"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          
          {suffix && !clearable && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
              {suffix}
            </div>
          )}
        </div>
        
        {error && (
          <p id={errorId} className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
        
        {helperText && !error && (
          <p id={helperId} className="mt-1 text-sm text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'