/**
 * Utility for merging class names
 * Combines clsx and tailwind-merge for optimal class handling
 */
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}