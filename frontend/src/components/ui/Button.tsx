/**
 * Button component with multiple variants and states
 * Core UI component for the Legal AI Platform
 */
import React, { forwardRef, ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'
import { Loader2 } from 'lucide-react'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
        secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus-visible:ring-gray-500',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
        ghost: 'hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-500',
        link: 'text-blue-600 underline-offset-4 hover:underline focus-visible:ring-blue-500',
      },
      size: {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
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
      buttonVariants({ variant, size, fullWidth }),
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