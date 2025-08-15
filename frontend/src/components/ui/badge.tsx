import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-full font-medium transition-colors",
  {
    variants: {
      variant: {
        primary: "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400",
        success: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
        error: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
        warning: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400",
        light: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80",
        // Keep legacy variants
        default: "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400",
        secondary: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80",
        destructive: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
        outline: "border border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300",
      },
      size: {
        sm: "px-2.5 py-0.5 text-xs",
        md: "px-2.5 py-0.5 text-sm", 
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
}

function Badge({ className, variant, size, startIcon, endIcon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {startIcon && <span className="mr-1">{startIcon}</span>}
      {children}
      {endIcon && <span className="ml-1">{endIcon}</span>}
    </span>
  )
}

export { Badge, badgeVariants }