/**
 * Responsive Container Component
 * Provides consistent spacing and responsive behavior
 */
import React from 'react'
import { cn } from '@/lib/utils'

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  centerContent?: boolean
  noPadding?: boolean
}

export function Container({ 
  children, 
  className, 
  size = 'xl',
  centerContent = false,
  noPadding = false,
  ...props 
}: ContainerProps) {
  return (
    <div 
      className={cn(
        // Base responsive container styles
        'w-full mx-auto',
        // Size variants
        {
          'max-w-screen-sm': size === 'sm',
          'max-w-screen-md': size === 'md', 
          'max-w-screen-lg': size === 'lg',
          'max-w-screen-xl': size === 'xl',
          'max-w-none': size === 'full',
        },
        // Padding (responsive)
        !noPadding && 'px-4 sm:px-6 lg:px-8',
        // Center content
        centerContent && 'flex items-center justify-center min-h-screen',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}