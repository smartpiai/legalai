/**
 * Tests for Breadcrumbs component
 * Following TDD approach
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Breadcrumbs } from './Breadcrumbs'

// Mock useLocation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

describe('Breadcrumbs', () => {
  describe('Basic rendering', () => {
    it('should render breadcrumb items', () => {
      const items = [
        { label: 'Home', path: '/' },
        { label: 'Contracts', path: '/contracts' },
        { label: 'Details', path: '/contracts/123' }
      ]

      render(
        <MemoryRouter>
          <Breadcrumbs items={items} />
        </MemoryRouter>
      )

      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('Contracts')).toBeInTheDocument()
      expect(screen.getByText('Details')).toBeInTheDocument()
    })

    it('should render separators between items', () => {
      const items = [
        { label: 'Home', path: '/' },
        { label: 'Contracts', path: '/contracts' }
      ]

      render(
        <MemoryRouter>
          <Breadcrumbs items={items} />
        </MemoryRouter>
      )

      // Default separator is "/"
      const separators = screen.getAllByText('/')
      expect(separators).toHaveLength(1)
    })

    it('should use custom separator when provided', () => {
      const items = [
        { label: 'Home', path: '/' },
        { label: 'Contracts', path: '/contracts' },
        { label: 'Details', path: '/contracts/123' }
      ]

      render(
        <MemoryRouter>
          <Breadcrumbs items={items} separator=">" />
        </MemoryRouter>
      )

      const separators = screen.getAllByText('>')
      expect(separators).toHaveLength(2)
    })

    it('should render custom separator component', () => {
      const items = [
        { label: 'Home', path: '/' },
        { label: 'Contracts', path: '/contracts' }
      ]

      const CustomSeparator = () => <span data-testid="custom-separator">→</span>

      render(
        <MemoryRouter>
          <Breadcrumbs items={items} separator={<CustomSeparator />} />
        </MemoryRouter>
      )

      expect(screen.getByTestId('custom-separator')).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('should navigate when clicking breadcrumb links', async () => {
      const user = userEvent.setup()
      const items = [
        { label: 'Home', path: '/' },
        { label: 'Contracts', path: '/contracts' },
        { label: 'Details', path: '/contracts/123' }
      ]

      render(
        <MemoryRouter>
          <Breadcrumbs items={items} />
        </MemoryRouter>
      )

      await user.click(screen.getByText('Contracts'))
      expect(mockNavigate).toHaveBeenCalledWith('/contracts')
    })

    it('should not navigate for last item (current page)', async () => {
      const user = userEvent.setup()
      const items = [
        { label: 'Home', path: '/' },
        { label: 'Current Page', path: '/current' }
      ]

      render(
        <MemoryRouter>
          <Breadcrumbs items={items} />
        </MemoryRouter>
      )

      const lastItem = screen.getByText('Current Page')
      expect(lastItem.closest('a')).not.toBeInTheDocument()
      
      await user.click(lastItem)
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('should handle onClick callback when provided', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      const items = [
        { label: 'Home', path: '/', onClick },
        { label: 'Contracts', path: '/contracts' }
      ]

      render(
        <MemoryRouter>
          <Breadcrumbs items={items} />
        </MemoryRouter>
      )

      await user.click(screen.getByText('Home'))
      expect(onClick).toHaveBeenCalledWith(expect.objectContaining({
        label: 'Home',
        path: '/'
      }))
    })
  })

  describe('Auto-generation from route', () => {
    it('should auto-generate breadcrumbs from current route', () => {
      render(
        <MemoryRouter initialEntries={['/contracts/123/edit']}>
          <Routes>
            <Route path="/contracts/:id/edit" element={
              <Breadcrumbs autoGenerate />
            } />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('Contracts')).toBeInTheDocument()
      expect(screen.getByText('123')).toBeInTheDocument()
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })

    it('should use route mapping for labels when provided', () => {
      const routeMapping = {
        '/': 'Dashboard',
        '/contracts': 'All Contracts',
        '/contracts/:id': 'Contract Details',
        '/contracts/:id/edit': 'Edit Contract'
      }

      render(
        <MemoryRouter initialEntries={['/contracts/123/edit']}>
          <Routes>
            <Route path="/contracts/:id/edit" element={
              <Breadcrumbs autoGenerate routeMapping={routeMapping} />
            } />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('All Contracts')).toBeInTheDocument()
      expect(screen.getByText('Contract Details')).toBeInTheDocument()
      expect(screen.getByText('Edit Contract')).toBeInTheDocument()
    })

    it('should exclude paths based on filter', () => {
      const excludePaths = ['/contracts/123']

      render(
        <MemoryRouter initialEntries={['/contracts/123/edit']}>
          <Routes>
            <Route path="/contracts/:id/edit" element={
              <Breadcrumbs autoGenerate excludePaths={excludePaths} />
            } />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('Contracts')).toBeInTheDocument()
      expect(screen.queryByText('123')).not.toBeInTheDocument()
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
  })

  describe('Styling and customization', () => {
    it('should apply custom className', () => {
      const items = [{ label: 'Home', path: '/' }]

      const { container } = render(
        <MemoryRouter>
          <Breadcrumbs items={items} className="custom-breadcrumbs" />
        </MemoryRouter>
      )

      expect(container.querySelector('.custom-breadcrumbs')).toBeInTheDocument()
    })

    it('should apply item-specific styles', () => {
      const items = [
        { label: 'Home', path: '/', className: 'home-link' },
        { label: 'Contracts', path: '/contracts' }
      ]

      render(
        <MemoryRouter>
          <Breadcrumbs items={items} />
        </MemoryRouter>
      )

      const homeLink = screen.getByText('Home')
      expect(homeLink.closest('a')).toHaveClass('home-link')
    })

    it('should render icons when provided', () => {
      const HomeIcon = () => <span data-testid="home-icon">🏠</span>
      const items = [
        { label: 'Home', path: '/', icon: <HomeIcon /> },
        { label: 'Contracts', path: '/contracts' }
      ]

      render(
        <MemoryRouter>
          <Breadcrumbs items={items} />
        </MemoryRouter>
      )

      expect(screen.getByTestId('home-icon')).toBeInTheDocument()
    })

    it('should show loading state when specified', () => {
      render(
        <MemoryRouter>
          <Breadcrumbs isLoading />
        </MemoryRouter>
      )

      expect(screen.getByTestId('breadcrumbs-skeleton')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const items = [
        { label: 'Home', path: '/' },
        { label: 'Contracts', path: '/contracts' }
      ]

      const { container } = render(
        <MemoryRouter>
          <Breadcrumbs items={items} />
        </MemoryRouter>
      )

      const nav = container.querySelector('nav')
      expect(nav).toHaveAttribute('aria-label', 'Breadcrumb')
      
      const list = container.querySelector('ol')
      expect(list).toBeInTheDocument()
    })

    it('should mark current page with aria-current', () => {
      const items = [
        { label: 'Home', path: '/' },
        { label: 'Current', path: '/current' }
      ]

      render(
        <MemoryRouter>
          <Breadcrumbs items={items} />
        </MemoryRouter>
      )

      const currentItem = screen.getByText('Current')
      expect(currentItem).toHaveAttribute('aria-current', 'page')
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      const items = [
        { label: 'Home', path: '/' },
        { label: 'Contracts', path: '/contracts' }
      ]

      render(
        <MemoryRouter>
          <Breadcrumbs items={items} />
        </MemoryRouter>
      )

      const homeLink = screen.getByText('Home').closest('a')
      homeLink?.focus()
      
      await user.keyboard('{Enter}')
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  describe('Maximum items', () => {
    it('should truncate when exceeding maxItems', () => {
      const items = [
        { label: 'Home', path: '/' },
        { label: 'Category', path: '/category' },
        { label: 'Subcategory', path: '/category/sub' },
        { label: 'Item', path: '/category/sub/item' },
        { label: 'Details', path: '/category/sub/item/details' }
      ]

      render(
        <MemoryRouter>
          <Breadcrumbs items={items} maxItems={3} />
        </MemoryRouter>
      )

      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('...')).toBeInTheDocument()
      expect(screen.getByText('Details')).toBeInTheDocument()
      expect(screen.queryByText('Category')).not.toBeInTheDocument()
    })

    it('should show all items when clicking ellipsis', async () => {
      const user = userEvent.setup()
      const items = [
        { label: 'Home', path: '/' },
        { label: 'Category', path: '/category' },
        { label: 'Subcategory', path: '/category/sub' },
        { label: 'Item', path: '/category/sub/item' }
      ]

      render(
        <MemoryRouter>
          <Breadcrumbs items={items} maxItems={3} />
        </MemoryRouter>
      )

      const ellipsis = screen.getByText('...')
      await user.click(ellipsis)

      expect(screen.getByText('Category')).toBeInTheDocument()
      expect(screen.getByText('Subcategory')).toBeInTheDocument()
    })
  })
})