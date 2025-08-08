/**
 * useNavigationGuard hook
 * Prevents users from accidentally navigating away from pages with unsaved changes
 */
import { useEffect, useCallback, useState } from 'react'
import { useBlocker } from 'react-router-dom'

interface UseNavigationGuardOptions {
  when: boolean
  message: string | (() => string)
  customConfirm?: (message: string) => Promise<boolean>
  onConfirm?: () => void
  onCancel?: () => void
  onReset?: () => void
  blockBrowserNavigation?: boolean
}

interface UseNavigationGuardReturn {
  isBlocking: boolean
  handleNavigation: () => void
  reset: () => void
}

export function useNavigationGuard({
  when,
  message,
  customConfirm,
  onConfirm,
  onCancel,
  onReset,
  blockBrowserNavigation = true
}: UseNavigationGuardOptions): UseNavigationGuardReturn {
  const [isBlocking, setIsBlocking] = useState(when)
  const blocker = useBlocker(when)

  // Update blocking state when condition changes
  useEffect(() => {
    setIsBlocking(when)
  }, [when])

  // Handle browser navigation (back/forward buttons, refresh, close)
  useEffect(() => {
    if (!blockBrowserNavigation || !when) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Chrome requires returnValue to be set
      event.returnValue = ''
      return ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [when, blockBrowserNavigation])

  // Get the message (either string or function result)
  const getMessage = useCallback(() => {
    return typeof message === 'function' ? message() : message
  }, [message])

  // Handle navigation attempts
  const handleNavigation = useCallback(async () => {
    if (blocker.state !== 'blocked') return

    const confirmMessage = getMessage()
    
    let shouldProceed: boolean
    
    if (customConfirm) {
      shouldProceed = await customConfirm(confirmMessage)
    } else {
      shouldProceed = window.confirm(confirmMessage)
    }

    if (shouldProceed) {
      onConfirm?.()
      blocker.proceed?.()
    } else {
      onCancel?.()
      blocker.reset?.()
    }
  }, [blocker, getMessage, customConfirm, onConfirm, onCancel])

  // Reset the blocking state
  const reset = useCallback(() => {
    setIsBlocking(false)
    onReset?.()
  }, [onReset])

  // Auto-handle navigation when blocker state changes
  useEffect(() => {
    if (blocker.state === 'blocked') {
      handleNavigation()
    }
  }, [blocker.state, handleNavigation])

  return {
    isBlocking,
    handleNavigation,
    reset
  }
}

// Convenience hook for forms with unsaved changes
export function useFormNavigationGuard(isDirty: boolean, customMessage?: string) {
  return useNavigationGuard({
    when: isDirty,
    message: customMessage || 'You have unsaved changes. Are you sure you want to leave?'
  })
}