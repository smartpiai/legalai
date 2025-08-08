/**
 * Tests for FilterSortControls component
 * Following TDD approach - tests written first
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterSortControls } from './FilterSortControls'

// Mock filter options data
const mockFilterOptions = {
  status: [
    { value: 'active', label: 'Active', count: 45 },
    { value: 'draft', label: 'Draft', count: 12 },
    { value: 'pending_review', label: 'Pending Review', count: 8 },
    { value: 'expired', label: 'Expired', count: 3 }
  ],
  type: [
    { value: 'service', label: 'Service Agreement', count: 23 },
    { value: 'nda', label: 'NDA', count: 18 },
    { value: 'master', label: 'Master Agreement', count: 15 },
    { value: 'employment', label: 'Employment Contract', count: 12 }
  ],
  assignee: [
    { value: 'john-doe', label: 'John Doe', count: 25 },
    { value: 'jane-smith', label: 'Jane Smith', count: 20 },
    { value: 'unassigned', label: 'Unassigned', count: 23 }
  ]
}

const mockSortOptions = [
  { value: 'created_at_desc', label: 'Recently Created' },
  { value: 'created_at_asc', label: 'Oldest First' },
  { value: 'updated_at_desc', label: 'Recently Updated' },
  { value: 'title_asc', label: 'Name (A-Z)' },
  { value: 'title_desc', label: 'Name (Z-A)' },
  { value: 'status_asc', label: 'Status' },
  { value: 'expiry_date_asc', label: 'Expiry Date' }
]

const mockActiveFilters = {
  status: ['active', 'pending_review'],
  type: ['service'],
  assignee: []
}

describe('FilterSortControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic rendering', () => {
    it('should render filter and sort controls', () => {
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
        />
      )
      
      expect(screen.getByText('Filters')).toBeInTheDocument()
      expect(screen.getByText('Sort')).toBeInTheDocument()
      expect(screen.getByTestId('filter-sort-container')).toBeInTheDocument()
    })

    it('should render search input', () => {
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          showSearch={true}
        />
      )
      
      expect(screen.getByPlaceholderText('Search contracts...')).toBeInTheDocument()
      expect(screen.getByTestId('search-input')).toBeInTheDocument()
    })

    it('should display active filter count', () => {
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          activeFilters={mockActiveFilters}
        />
      )
      
      // 3 active filters: 2 status + 1 type
      expect(screen.getByText('3 filters')).toBeInTheDocument()
      expect(screen.getByTestId('active-filter-count')).toBeInTheDocument()
    })

    it('should not show filter count when no active filters', () => {
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          activeFilters={{}}
        />
      )
      
      expect(screen.queryByTestId('active-filter-count')).not.toBeInTheDocument()
    })
  })

  describe('Filter functionality', () => {
    it('should show filter dropdown when clicked', async () => {
      const user = userEvent.setup()
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
        />
      )
      
      await user.click(screen.getByTestId('filters-button'))
      
      expect(screen.getByTestId('filters-dropdown')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Type')).toBeInTheDocument()
      expect(screen.getByText('Assignee')).toBeInTheDocument()
    })

    it('should display filter options with counts', async () => {
      const user = userEvent.setup()
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
        />
      )
      
      await user.click(screen.getByTestId('filters-button'))
      
      expect(screen.getByText('Active (45)')).toBeInTheDocument()
      expect(screen.getByText('Draft (12)')).toBeInTheDocument()
      expect(screen.getByText('Service Agreement (23)')).toBeInTheDocument()
    })

    it('should handle filter selection', async () => {
      const user = userEvent.setup()
      const onFiltersChange = vi.fn()
      
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          onFiltersChange={onFiltersChange}
        />
      )
      
      await user.click(screen.getByTestId('filters-button'))
      await user.click(screen.getByLabelText('Active (45)'))
      
      expect(onFiltersChange).toHaveBeenCalledWith({
        status: ['active']
      })
    })

    it('should handle multiple filter selection', async () => {
      const user = userEvent.setup()
      const onFiltersChange = vi.fn()
      
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          onFiltersChange={onFiltersChange}
          activeFilters={{ status: ['active'] }}
        />
      )
      
      await user.click(screen.getByTestId('filters-button'))
      await user.click(screen.getByLabelText('Draft (12)'))
      
      expect(onFiltersChange).toHaveBeenCalledWith({
        status: ['active', 'draft']
      })
    })

    it('should deselect filter when clicked again', async () => {
      const user = userEvent.setup()
      const onFiltersChange = vi.fn()
      
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          onFiltersChange={onFiltersChange}
          activeFilters={{ status: ['active', 'draft'] }}
        />
      )
      
      await user.click(screen.getByTestId('filters-button'))
      await user.click(screen.getByLabelText('Active (45)'))
      
      expect(onFiltersChange).toHaveBeenCalledWith({
        status: ['draft']
      })
    })

    it('should clear all filters when clear button is clicked', async () => {
      const user = userEvent.setup()
      const onFiltersChange = vi.fn()
      
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          onFiltersChange={onFiltersChange}
          activeFilters={mockActiveFilters}
        />
      )
      
      await user.click(screen.getByTestId('filters-button'))
      await user.click(screen.getByText('Clear All'))
      
      expect(onFiltersChange).toHaveBeenCalledWith({})
    })
  })

  describe('Sort functionality', () => {
    it('should show sort dropdown when clicked', async () => {
      const user = userEvent.setup()
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
        />
      )
      
      await user.click(screen.getByTestId('sort-button'))
      
      expect(screen.getByTestId('sort-dropdown')).toBeInTheDocument()
      expect(screen.getByText('Recently Created')).toBeInTheDocument()
      expect(screen.getByText('Name (A-Z)')).toBeInTheDocument()
    })

    it('should display current sort selection', () => {
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          currentSort="title_asc"
        />
      )
      
      expect(screen.getByText('Name (A-Z)')).toBeInTheDocument()
    })

    it('should handle sort selection', async () => {
      const user = userEvent.setup()
      const onSortChange = vi.fn()
      
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          onSortChange={onSortChange}
        />
      )
      
      await user.click(screen.getByTestId('sort-button'))
      await user.click(screen.getByText('Name (A-Z)'))
      
      expect(onSortChange).toHaveBeenCalledWith('title_asc')
    })

    it('should show default sort when none selected', () => {
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
        />
      )
      
      expect(screen.getByText('Sort')).toBeInTheDocument()
    })
  })

  describe('Search functionality', () => {
    it('should handle search input changes', async () => {
      const user = userEvent.setup()
      const onSearchChange = vi.fn()
      
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          showSearch={true}
          onSearchChange={onSearchChange}
        />
      )
      
      const searchInput = screen.getByTestId('search-input')
      await user.type(searchInput, 'test contract')
      
      await waitFor(() => {
        expect(onSearchChange).toHaveBeenCalledWith('test contract')
      })
    })

    it('should debounce search input', async () => {
      const user = userEvent.setup()
      const onSearchChange = vi.fn()
      
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          showSearch={true}
          onSearchChange={onSearchChange}
          searchDebounce={300}
        />
      )
      
      const searchInput = screen.getByTestId('search-input')
      await user.type(searchInput, 'fast')
      
      // Should not call immediately
      expect(onSearchChange).not.toHaveBeenCalled()
      
      // Wait for debounce
      await waitFor(() => {
        expect(onSearchChange).toHaveBeenCalledWith('fast')
      }, { timeout: 400 })
    })

    it('should clear search when clear button is clicked', async () => {
      const user = userEvent.setup()
      const onSearchChange = vi.fn()
      
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          showSearch={true}
          searchValue="test"
          onSearchChange={onSearchChange}
        />
      )
      
      await user.click(screen.getByTestId('clear-search-button'))
      expect(onSearchChange).toHaveBeenCalledWith('')
    })
  })

  describe('Active filter chips', () => {
    it('should display active filter chips', () => {
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          activeFilters={mockActiveFilters}
          showActiveFilters={true}
        />
      )
      
      expect(screen.getByText('Status: Active')).toBeInTheDocument()
      expect(screen.getByText('Status: Pending Review')).toBeInTheDocument()
      expect(screen.getByText('Type: Service Agreement')).toBeInTheDocument()
    })

    it('should remove filter when chip close button is clicked', async () => {
      const user = userEvent.setup()
      const onFiltersChange = vi.fn()
      
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          activeFilters={mockActiveFilters}
          showActiveFilters={true}
          onFiltersChange={onFiltersChange}
        />
      )
      
      // Find and click the close button for the 'Active' filter chip
      const activeChip = screen.getByText('Status: Active').closest('div')
      const closeButton = activeChip?.querySelector('[data-testid="remove-filter-status-active"]')
      
      if (closeButton) {
        await user.click(closeButton)
        expect(onFiltersChange).toHaveBeenCalledWith({
          status: ['pending_review'],
          type: ['service']
        })
      }
    })

    it('should not show chips when showActiveFilters is false', () => {
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          activeFilters={mockActiveFilters}
          showActiveFilters={false}
        />
      )
      
      expect(screen.queryByText('Status: Active')).not.toBeInTheDocument()
    })
  })

  describe('Loading states', () => {
    it('should show loading state for filter options', () => {
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          isLoading={{ filters: true }}
        />
      )
      
      const filtersButton = screen.getByTestId('filters-button')
      expect(filtersButton).toBeDisabled()
      expect(screen.getByTestId('filters-loading')).toBeInTheDocument()
    })

    it('should show loading state for search', () => {
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          showSearch={true}
          isLoading={{ search: true }}
        />
      )
      
      expect(screen.getByTestId('search-loading')).toBeInTheDocument()
    })
  })

  describe('Custom styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          className="custom-controls"
        />
      )
      
      expect(container.firstChild).toHaveClass('custom-controls')
    })

    it('should use compact variant when specified', () => {
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          variant="compact"
        />
      )
      
      const container = screen.getByTestId('filter-sort-container')
      expect(container).toHaveClass('space-x-2') // More compact spacing
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
        />
      )
      
      expect(screen.getByTestId('filters-button')).toHaveAttribute('aria-label', 'Filter contracts')
      expect(screen.getByTestId('sort-button')).toHaveAttribute('aria-label', 'Sort contracts')
    })

    it('should have proper ARIA expanded states', async () => {
      const user = userEvent.setup()
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
        />
      )
      
      const filtersButton = screen.getByTestId('filters-button')
      expect(filtersButton).toHaveAttribute('aria-expanded', 'false')
      
      await user.click(filtersButton)
      expect(filtersButton).toHaveAttribute('aria-expanded', 'true')
    })

    it('should support keyboard navigation', () => {
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
        />
      )
      
      expect(screen.getByTestId('filters-button')).toHaveAttribute('tabIndex', '0')
      expect(screen.getByTestId('sort-button')).toHaveAttribute('tabIndex', '0')
    })
  })

  describe('Mobile responsiveness', () => {
    it('should show mobile layout on small screens', () => {
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          isMobile={true}
        />
      )
      
      expect(screen.getByTestId('mobile-filter-button')).toBeInTheDocument()
    })

    it('should collapse search on mobile when not focused', () => {
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          showSearch={true}
          isMobile={true}
        />
      )
      
      const searchContainer = screen.getByTestId('search-container')
      expect(searchContainer).toHaveClass('hidden') // Hidden by default on mobile
    })
  })

  describe('Preset filters', () => {
    it('should show preset filter buttons', () => {
      const presets = [
        { id: 'my-contracts', label: 'My Contracts', filters: { assignee: ['john-doe'] } },
        { id: 'expiring-soon', label: 'Expiring Soon', filters: { status: ['active'], expiry: 'soon' } }
      ]
      
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          presetFilters={presets}
        />
      )
      
      expect(screen.getByText('My Contracts')).toBeInTheDocument()
      expect(screen.getByText('Expiring Soon')).toBeInTheDocument()
    })

    it('should apply preset filters when clicked', async () => {
      const user = userEvent.setup()
      const onFiltersChange = vi.fn()
      const presets = [
        { id: 'my-contracts', label: 'My Contracts', filters: { assignee: ['john-doe'] } }
      ]
      
      render(
        <FilterSortControls 
          filterOptions={mockFilterOptions}
          sortOptions={mockSortOptions}
          presetFilters={presets}
          onFiltersChange={onFiltersChange}
        />
      )
      
      await user.click(screen.getByText('My Contracts'))
      expect(onFiltersChange).toHaveBeenCalledWith({ assignee: ['john-doe'] })
    })
  })
})