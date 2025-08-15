/**
 * Button component with multiple variants and states
 * Core UI component for the Legal AI Platform
 */
import React, { forwardRef, ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg transition-colors font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 focus-visible:ring-brand-500/20',
        outline: 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] dark:hover:text-gray-300',
        ghost: 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5',
        destructive: 'bg-error-500 text-white shadow-theme-xs hover:bg-error-600',
        success: 'bg-success-500 text-white shadow-theme-xs hover:bg-success-600',
        warning: 'bg-warning-500 text-white shadow-theme-xs hover:bg-warning-600',
        // Keep legacy variants for compatibility
        default: 'bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600',
        secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300',
        link: 'text-brand-500 underline-offset-4 hover:underline',
        danger: 'bg-error-500 text-white shadow-theme-xs hover:bg-error-600',
      },
      size: {
        sm: 'px-4 py-3 text-sm h-11',
        md: 'px-5 py-3.5 text-sm h-12',
        lg: 'px-6 py-4 text-base h-14',
        icon: 'h-10 w-10 p-0',
        // Keep legacy sizes for compatibility
        default: 'px-5 py-3.5 text-sm h-12',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  icon?: React.ReactNode
  fullWidth?: boolean
  href?: string
  external?: boolean
  ariaLabel?: string
  ariaDescribedBy?: string
  ariaPressed?: boolean
  disabled?: boolean
  asChild?: boolean
}

export const Button = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonProps
>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      loading = false,
      disabled = false,
      icon,
      children,
      href,
      external = false,
      ariaLabel,
      ariaDescribedBy,
      ariaPressed,
      onClick,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    const handleClick = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
      if (isDisabled || loading) {
        e.preventDefault()
        return
      }
      onClick?.(e as React.MouseEvent<HTMLButtonElement>)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if ((e.key === 'Enter' || e.key === ' ') && !isDisabled && !loading) {
        e.preventDefault()
        onClick?.(e as any)
      }
    }

    const buttonContent = (
      <>
        {loading && (
          <Loader2 
            className="mr-2 h-4 w-4 animate-spin" 
            data-testid="button-spinner"
          />
        )}
        {icon && !loading && <span className="mr-2">{icon}</span>}
        {children}
      </>
    )

    const buttonClassName = cn(
      buttonVariants({ variant, size }),
      fullWidth && 'w-full',
      className
    )

    const commonProps = {
      className: buttonClassName,
      'aria-label': ariaLabel,
      'aria-describedby': ariaDescribedBy,
      'aria-pressed': ariaPressed,
    }

    if (href) {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
          onClick={handleClick}
          {...commonProps}
          {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {buttonContent}
        </a>
      )
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        disabled={isDisabled}
        aria-busy={loading}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...commonProps}
        {...props}
      >
        {buttonContent}
      </button>
    )
  }
)

Button.displayName = 'Button'