/**
 * Tests for Card component
 * Following TDD - Red phase: Write failing tests first
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@/test/utils'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card'

describe('Card Component', () => {
  describe('Card Container', () => {
    it('should render card with children', () => {
      render(
        <Card>
          <div>Card content</div>
        </Card>
      )
      expect(screen.getByText(/card content/i)).toBeInTheDocument()
    })

    it('should render with different variants', () => {
      const { rerender } = render(<Card variant="default">Default</Card>)
      expect(screen.getByText(/default/i).parentElement).toHaveClass('bg-white')

      rerender(<Card variant="bordered">Bordered</Card>)
      expect(screen.getByText(/bordered/i).parentElement).toHaveClass('border')

      rerender(<Card variant="elevated">Elevated</Card>)
      expect(screen.getByText(/elevated/i).parentElement).toHaveClass('shadow-lg')
    })

    it('should handle click events', () => {
      const handleClick = vi.fn()
      render(
        <Card onClick={handleClick} clickable>
          Clickable card
        </Card>
      )
      
      fireEvent.click(screen.getByText(/clickable card/i).parentElement!)
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should show hover effect when clickable', () => {
      render(<Card clickable>Hoverable</Card>)
      const card = screen.getByText(/hoverable/i).parentElement
      expect(card).toHaveClass('hover:shadow-md')
      expect(card).toHaveClass('cursor-pointer')
    })

    it('should accept custom className', () => {
      render(<Card className="custom-class">Custom</Card>)
      expect(screen.getByText(/custom/i).parentElement).toHaveClass('custom-class')
    })

    it('should render as different HTML element when specified', () => {
      render(<Card as="section">Section Card</Card>)
      expect(screen.getByText(/section card/i).parentElement?.tagName).toBe('SECTION')
    })
  })

  describe('CardHeader', () => {
    it('should render header with content', () => {
      render(
        <Card>
          <CardHeader>Header content</CardHeader>
        </Card>
      )
      expect(screen.getByText(/header content/i)).toBeInTheDocument()
    })

    it('should apply proper spacing', () => {
      render(
        <Card>
          <CardHeader>Header</CardHeader>
        </Card>
      )
      expect(screen.getByText(/header/i).parentElement).toHaveClass('p-6')
    })

    it('should accept custom className', () => {
      render(
        <Card>
          <CardHeader className="custom-header">Header</CardHeader>
        </Card>
      )
      expect(screen.getByText(/header/i).parentElement).toHaveClass('custom-header')
    })
  })

  describe('CardTitle', () => {
    it('should render title text', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
          </CardHeader>
        </Card>
      )
      expect(screen.getByText(/card title/i)).toBeInTheDocument()
    })

    it('should render with different sizes', () => {
      const { rerender } = render(
        <CardTitle size="sm">Small Title</CardTitle>
      )
      expect(screen.getByText(/small title/i)).toHaveClass('text-lg')

      rerender(<CardTitle size="md">Medium Title</CardTitle>)
      expect(screen.getByText(/medium title/i)).toHaveClass('text-xl')

      rerender(<CardTitle size="lg">Large Title</CardTitle>)
      expect(screen.getByText(/large title/i)).toHaveClass('text-2xl')
    })

    it('should render as different heading levels', () => {
      const { rerender } = render(<CardTitle as="h1">H1 Title</CardTitle>)
      expect(screen.getByText(/h1 title/i).tagName).toBe('H1')

      rerender(<CardTitle as="h2">H2 Title</CardTitle>)
      expect(screen.getByText(/h2 title/i).tagName).toBe('H2')

      rerender(<CardTitle as="h3">H3 Title</CardTitle>)
      expect(screen.getByText(/h3 title/i).tagName).toBe('H3')
    })
  })

  describe('CardDescription', () => {
    it('should render description text', () => {
      render(
        <Card>
          <CardHeader>
            <CardDescription>Card description text</CardDescription>
          </CardHeader>
        </Card>
      )
      expect(screen.getByText(/card description text/i)).toBeInTheDocument()
    })

    it('should have muted text color', () => {
      render(<CardDescription>Description</CardDescription>)
      expect(screen.getByText(/description/i)).toHaveClass('text-gray-500')
    })

    it('should accept custom className', () => {
      render(
        <CardDescription className="custom-description">
          Description
        </CardDescription>
      )
      expect(screen.getByText(/description/i)).toHaveClass('custom-description')
    })
  })

  describe('CardContent', () => {
    it('should render content', () => {
      render(
        <Card>
          <CardContent>Main content</CardContent>
        </Card>
      )
      expect(screen.getByText(/main content/i)).toBeInTheDocument()
    })

    it('should apply proper spacing', () => {
      render(
        <Card>
          <CardContent>Content</CardContent>
        </Card>
      )
      expect(screen.getByText(/content/i).parentElement).toHaveClass('p-6')
      expect(screen.getByText(/content/i).parentElement).toHaveClass('pt-0')
    })

    it('should render with no padding when specified', () => {
      render(
        <Card>
          <CardContent noPadding>No padding content</CardContent>
        </Card>
      )
      expect(screen.getByText(/no padding content/i).parentElement).not.toHaveClass('p-6')
    })
  })

  describe('CardFooter', () => {
    it('should render footer content', () => {
      render(
        <Card>
          <CardFooter>Footer content</CardFooter>
        </Card>
      )
      expect(screen.getByText(/footer content/i)).toBeInTheDocument()
    })

    it('should apply proper spacing and alignment', () => {
      render(
        <Card>
          <CardFooter>Footer</CardFooter>
        </Card>
      )
      const footer = screen.getByText(/footer/i).parentElement
      expect(footer).toHaveClass('p-6')
      expect(footer).toHaveClass('pt-0')
      expect(footer).toHaveClass('flex')
    })

    it('should align content properly', () => {
      const { rerender } = render(
        <CardFooter align="start">Start aligned</CardFooter>
      )
      expect(screen.getByText(/start aligned/i).parentElement).toHaveClass('justify-start')

      rerender(<CardFooter align="center">Center aligned</CardFooter>)
      expect(screen.getByText(/center aligned/i).parentElement).toHaveClass('justify-center')

      rerender(<CardFooter align="end">End aligned</CardFooter>)
      expect(screen.getByText(/end aligned/i).parentElement).toHaveClass('justify-end')

      rerender(<CardFooter align="between">Between aligned</CardFooter>)
      expect(screen.getByText(/between aligned/i).parentElement).toHaveClass('justify-between')
    })
  })

  describe('Composition', () => {
    it('should render complete card with all sections', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>Content</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
      )
      
      expect(screen.getByText(/title/i)).toBeInTheDocument()
      expect(screen.getByText(/description/i)).toBeInTheDocument()
      expect(screen.getByText(/content/i)).toBeInTheDocument()
      expect(screen.getByText(/footer/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should support ARIA attributes', () => {
      render(
        <Card role="article" aria-label="Important card">
          Content
        </Card>
      )
      const card = screen.getByRole('article')
      expect(card).toHaveAttribute('aria-label', 'Important card')
    })

    it('should be keyboard navigable when clickable', () => {
      const handleClick = vi.fn()
      render(
        <Card clickable onClick={handleClick} tabIndex={0}>
          Keyboard navigable
        </Card>
      )
      
      const card = screen.getByText(/keyboard navigable/i).parentElement!
      card.focus()
      expect(card).toHaveFocus()
      
      fireEvent.keyDown(card, { key: 'Enter' })
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })
})