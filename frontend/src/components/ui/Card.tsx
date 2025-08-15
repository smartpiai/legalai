/**
 * Card component with multiple sections
 * Container component for content grouping
 */
import React, { forwardRef, HTMLAttributes, ElementType } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const cardVariants = cva(
  'rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] transition-colors',
  {
    variants: {
      variant: {
        default: 'shadow-theme-sm',
        bordered: 'border-2',
        elevated: 'shadow-theme-lg',
      },
      clickable: {
        true: 'hover:shadow-theme-md cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  as?: ElementType
  clickable?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, clickable, as: Component = 'div', onClick, onKeyDown, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (clickable && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        onClick?.(e as any)
      }
      onKeyDown?.(e)
    }

    return (
      <Component
        ref={ref}
        className={cn(cardVariants({ variant, clickable }), className)}
        onClick={clickable ? onClick : undefined}
        onKeyDown={clickable ? handleKeyDown : onKeyDown}
        tabIndex={clickable ? 0 : undefined}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-5 md:p-6', className)}
      {...props}
    />
  )
)

CardHeader.displayName = 'CardHeader'

const titleVariants = cva(
  'font-semibold leading-none tracking-tight',
  {
    variants: {
      size: {
        sm: 'text-lg',
        md: 'text-xl',
        lg: 'text-2xl',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
)

export interface CardTitleProps
  extends HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof titleVariants> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, size, as: Component = 'h3', ...props }, ref) => (
    <Component
      ref={ref}
      className={cn(titleVariants({ size }), className)}
      {...props}
    />
  )
)

CardTitle.displayName = 'CardTitle'

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
)

CardDescription.displayName = 'CardDescription'

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean
}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, noPadding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(!noPadding && 'p-5 pt-0 md:p-6 md:pt-0', className)}
      {...props}
    />
  )
)

CardContent.displayName = 'CardContent'

const footerVariants = cva(
  'flex items-center p-6 pt-0',
  {
    variants: {
      align: {
        start: 'justify-start',
        center: 'justify-center',
        end: 'justify-end',
        between: 'justify-between',
      },
    },
    defaultVariants: {
      align: 'end',
    },
  }
)

export interface CardFooterProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof footerVariants> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, align, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(footerVariants({ align }), className)}
      {...props}
    />
  )
)

CardFooter.displayName = 'CardFooter'