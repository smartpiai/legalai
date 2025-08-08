/**
 * Card component with multiple sections
 * Container component for content grouping
 */
import React, { forwardRef, HTMLAttributes, ElementType } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'

const cardVariants = cva(
  'rounded-lg transition-all',
  {
    variants: {
      variant: {
        default: 'bg-white border border-gray-200',
        bordered: 'bg-white border-2 border-gray-300',
        elevated: 'bg-white shadow-lg',
      },
      clickable: {
        true: 'hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
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
      className={cn('flex flex-col space-y-1.5 p-6', className)}
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
      className={cn('text-sm text-gray-500', className)}
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
      className={cn(!noPadding && 'p-6 pt-0', className)}
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