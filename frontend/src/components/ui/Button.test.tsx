/**
 * Tests for Button component
 * Following TDD - Red phase: Write failing tests first
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@/test/utils'
import { Button } from './Button'

describe('Button Component', () => {
  describe('Rendering', () => {
    it('should render button with text', () => {
      render(<Button>Click me</Button>)
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
    })

    it('should render with different variants', () => {
      const { rerender } = render(<Button variant="primary">Primary</Button>)
      expect(screen.getByRole('button')).toHaveClass('bg-blue-600')

      rerender(<Button variant="secondary">Secondary</Button>)
      expect(screen.getByRole('button')).toHaveClass('bg-gray-200')

      rerender(<Button variant="danger">Danger</Button>)
      expect(screen.getByRole('button')).toHaveClass('bg-red-600')

      rerender(<Button variant="ghost">Ghost</Button>)
      expect(screen.getByRole('button')).toHaveClass('hover:bg-gray-100')
    })

    it('should render with different sizes', () => {
      const { rerender } = render(<Button size="sm">Small</Button>)
      expect(screen.getByRole('button')).toHaveClass('px-3 py-1.5 text-sm')

      rerender(<Button size="md">Medium</Button>)
      expect(screen.getByRole('button')).toHaveClass('px-4 py-2 text-base')

      rerender(<Button size="lg">Large</Button>)
      expect(screen.getByRole('button')).toHaveClass('px-6 py-3 text-lg')
    })

    it('should render as full width when specified', () => {
      render(<Button fullWidth>Full Width</Button>)
      expect(screen.getByRole('button')).toHaveClass('w-full')
    })

    it('should render with loading state', () => {
      render(<Button loading>Loading</Button>)
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByTestId('button-spinner')).toBeInTheDocument()
    })

    it('should render with icon', () => {
      const Icon = () => <svg data-testid="test-icon" />
      render(<Button icon={<Icon />}>With Icon</Button>)
      expect(screen.getByTestId('test-icon')).toBeInTheDocument()
    })

    it('should render as disabled', () => {
      render(<Button disabled>Disabled</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  describe('Interactions', () => {
    it('should call onClick handler when clicked', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click me</Button>)
      
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should not call onClick when disabled', () => {
      const handleClick = vi.fn()
      render(<Button disabled onClick={handleClick}>Disabled</Button>)
      
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should not call onClick when loading', () => {
      const handleClick = vi.fn()
      render(<Button loading onClick={handleClick}>Loading</Button>)
      
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should support keyboard navigation', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Keyboard</Button>)
      
      const button = screen.getByRole('button')
      button.focus()
      expect(button).toHaveFocus()
      
      fireEvent.keyDown(button, { key: 'Enter' })
      expect(handleClick).toHaveBeenCalledTimes(1)
      
      fireEvent.keyDown(button, { key: ' ' })
      expect(handleClick).toHaveBeenCalledTimes(2)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <Button
          ariaLabel="Custom label"
          ariaDescribedBy="description"
          ariaPressed={true}
        >
          Accessible
        </Button>
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-label', 'Custom label')
      expect(button).toHaveAttribute('aria-describedby', 'description')
      expect(button).toHaveAttribute('aria-pressed', 'true')
    })

    it('should have proper role', () => {
      render(<Button>Role Button</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should be focusable when not disabled', () => {
      render(<Button>Focusable</Button>)
      const button = screen.getByRole('button')
      expect(button).not.toHaveAttribute('tabindex', '-1')
    })

    it('should not be focusable when disabled', () => {
      render(<Button disabled>Not Focusable</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('disabled')
    })
  })

  describe('Button as Link', () => {
    it('should render as anchor tag when href is provided', () => {
      render(<Button href="/test">Link Button</Button>)
      const link = screen.getByRole('link', { name: /link button/i })
      expect(link).toHaveAttribute('href', '/test')
    })

    it('should open in new tab when external', () => {
      render(<Button href="https://example.com" external>External Link</Button>)
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  describe('Custom Styling', () => {
    it('should accept custom className', () => {
      render(<Button className="custom-class">Custom</Button>)
      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })

    it('should merge custom styles with default styles', () => {
      render(<Button className="mt-4" variant="primary">Merged</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-blue-600') // default primary style
      expect(button).toHaveClass('mt-4') // custom style
    })
  })
})