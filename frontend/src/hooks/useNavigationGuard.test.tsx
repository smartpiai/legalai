/**
 * Tests for useNavigationGuard hook
 * Navigation guards prevent users from accidentally leaving pages with unsaved changes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useNavigationGuard } from './useNavigationGuard'

// Mock window.confirm
const mockConfirm = vi.fn()
window.confirm = mockConfirm

// Mock the blocker from react-router
const mockBlocker = {
  state: 'unblocked' as const,
  proceed: vi.fn(),
  reset: vi.fn()
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useBlocker: vi.fn(() => mockBlocker)
  }
})

describe('useNavigationGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfirm.mockReturnValue(true)
  })

  describe('Basic functionality', () => {
    it('should not block navigation when condition is false', () => {
      const { result } = renderHook(
        () => useNavigationGuard({
          when: false,
          message: 'Are you sure you want to leave?'
        }),
        { wrapper: MemoryRouter }
      )

      expect(result.current.isBlocking).toBe(false)
    })

    it('should block navigation when condition is true', () => {
      const { result } = renderHook(
        () => useNavigationGuard({
          when: true,
          message: 'Are you sure you want to leave?'
        }),
        { wrapper: MemoryRouter }
      )

      expect(result.current.isBlocking).toBe(true)
    })

    it('should show confirmation dialog when navigating away', async () => {
      mockBlocker.state = 'blocked'
      
      const { result } = renderHook(
        () => useNavigationGuard({
          when: true,
          message: 'You have unsaved changes. Are you sure?'
        }),
        { wrapper: MemoryRouter }
      )

      // Trigger the confirmation
      act(() => {
        result.current.handleNavigation()
      })

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalledWith('You have unsaved changes. Are you sure?')
      })
    })

    it('should proceed with navigation when confirmed', async () => {
      mockConfirm.mockReturnValue(true)
      mockBlocker.state = 'blocked'
      
      const { result } = renderHook(
        () => useNavigationGuard({
          when: true,
          message: 'Discard changes?'
        }),
        { wrapper: MemoryRouter }
      )

      act(() => {
        result.current.handleNavigation()
      })

      await waitFor(() => {
        expect(mockBlocker.proceed).toHaveBeenCalled()
      })
    })

    it('should cancel navigation when not confirmed', async () => {
      mockConfirm.mockReturnValue(false)
      mockBlocker.state = 'blocked'
      
      const { result } = renderHook(
        () => useNavigationGuard({
          when: true,
          message: 'Discard changes?'
        }),
        { wrapper: MemoryRouter }
      )

      act(() => {
        result.current.handleNavigation()
      })

      await waitFor(() => {
        expect(mockBlocker.reset).toHaveBeenCalled()
        expect(mockBlocker.proceed).not.toHaveBeenCalled()
      })
    })
  })

  describe('Custom handlers', () => {
    it('should use custom onConfirm handler when provided', async () => {
      const onConfirm = vi.fn()
      mockBlocker.state = 'blocked'
      
      const { result } = renderHook(
        () => useNavigationGuard({
          when: true,
          message: 'Leave page?',
          onConfirm
        }),
        { wrapper: MemoryRouter }
      )

      mockConfirm.mockReturnValue(true)
      
      act(() => {
        result.current.handleNavigation()
      })

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled()
        expect(mockBlocker.proceed).toHaveBeenCalled()
      })
    })

    it('should use custom onCancel handler when provided', async () => {
      const onCancel = vi.fn()
      mockBlocker.state = 'blocked'
      
      const { result } = renderHook(
        () => useNavigationGuard({
          when: true,
          message: 'Leave page?',
          onCancel
        }),
        { wrapper: MemoryRouter }
      )

      mockConfirm.mockReturnValue(false)
      
      act(() => {
        result.current.handleNavigation()
      })

      await waitFor(() => {
        expect(onCancel).toHaveBeenCalled()
        expect(mockBlocker.reset).toHaveBeenCalled()
      })
    })

    it('should use custom confirmation function when provided', async () => {
      const customConfirm = vi.fn().mockResolvedValue(true)
      mockBlocker.state = 'blocked'
      
      const { result } = renderHook(
        () => useNavigationGuard({
          when: true,
          message: 'Leave page?',
          customConfirm
        }),
        { wrapper: MemoryRouter }
      )

      act(() => {
        result.current.handleNavigation()
      })

      await waitFor(() => {
        expect(customConfirm).toHaveBeenCalledWith('Leave page?')
        expect(mockConfirm).not.toHaveBeenCalled()
        expect(mockBlocker.proceed).toHaveBeenCalled()
      })
    })
  })

  describe('Dynamic conditions', () => {
    it('should respond to condition changes', () => {
      const { result, rerender } = renderHook(
        ({ when }) => useNavigationGuard({
          when,
          message: 'Leave?'
        }),
        { 
          wrapper: MemoryRouter,
          initialProps: { when: false }
        }
      )

      expect(result.current.isBlocking).toBe(false)

      // Change condition to true
      rerender({ when: true })
      expect(result.current.isBlocking).toBe(true)

      // Change back to false
      rerender({ when: false })
      expect(result.current.isBlocking).toBe(false)
    })

    it('should handle function-based messages', async () => {
      mockBlocker.state = 'blocked'
      const getMessage = vi.fn().mockReturnValue('Dynamic message')
      
      const { result } = renderHook(
        () => useNavigationGuard({
          when: true,
          message: getMessage
        }),
        { wrapper: MemoryRouter }
      )

      act(() => {
        result.current.handleNavigation()
      })

      await waitFor(() => {
        expect(getMessage).toHaveBeenCalled()
        expect(mockConfirm).toHaveBeenCalledWith('Dynamic message')
      })
    })
  })

  describe('Browser navigation', () => {
    it('should handle browser back/forward buttons', () => {
      const { result } = renderHook(
        () => useNavigationGuard({
          when: true,
          message: 'Leave page?',
          blockBrowserNavigation: true
        }),
        { wrapper: MemoryRouter }
      )

      // Simulate browser navigation
      const event = new Event('beforeunload', { cancelable: true })
      
      act(() => {
        window.dispatchEvent(event)
      })

      expect(event.defaultPrevented).toBe(true)
    })

    it('should not block browser navigation when disabled', () => {
      const { result } = renderHook(
        () => useNavigationGuard({
          when: true,
          message: 'Leave page?',
          blockBrowserNavigation: false
        }),
        { wrapper: MemoryRouter }
      )

      const event = new Event('beforeunload', { cancelable: true })
      
      act(() => {
        window.dispatchEvent(event)
      })

      expect(event.defaultPrevented).toBe(false)
    })

    it('should clean up event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
      
      const { unmount } = renderHook(
        () => useNavigationGuard({
          when: true,
          message: 'Leave?',
          blockBrowserNavigation: true
        }),
        { wrapper: MemoryRouter }
      )

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      )
    })
  })

  describe('Reset functionality', () => {
    it('should provide reset function to clear blocking state', () => {
      const { result } = renderHook(
        () => useNavigationGuard({
          when: true,
          message: 'Leave?'
        }),
        { wrapper: MemoryRouter }
      )

      expect(result.current.isBlocking).toBe(true)

      act(() => {
        result.current.reset()
      })

      expect(result.current.isBlocking).toBe(false)
    })

    it('should call onReset callback when resetting', () => {
      const onReset = vi.fn()
      
      const { result } = renderHook(
        () => useNavigationGuard({
          when: true,
          message: 'Leave?',
          onReset
        }),
        { wrapper: MemoryRouter }
      )

      act(() => {
        result.current.reset()
      })

      expect(onReset).toHaveBeenCalled()
    })
  })
})