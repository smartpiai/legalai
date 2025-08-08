/**
 * FilterSortControls component
 * Provides filtering, sorting, and searching capabilities for contract lists
 */
import { useState, useEffect, useMemo } from 'react'
import { 
  Filter, 
  ChevronDown, 
  Search,
  X,
  RefreshCw,
  SortAsc,
  Menu
} from 'lucide-react'
import { cn } from '@/utils/cn'

export interface FilterOption {
  value: string
  label: string
  count?: number
}

export interface FilterOptions {
  [key: string]: FilterOption[]
}

export interface SortOption {
  value: string
  label: string
}

export interface ActiveFilters {
  [key: string]: string[]
}

export interface PresetFilter {
  id: string
  label: string
  filters: Record<string, any>
}

interface LoadingStates {
  filters?: boolean
  search?: boolean
  sort?: boolean
}

interface FilterSortControlsProps {
  filterOptions: FilterOptions
  sortOptions: SortOption[]
  activeFilters?: ActiveFilters
  currentSort?: string
  searchValue?: string
  className?: string
  variant?: 'default' | 'compact'
  showSearch?: boolean
  showActiveFilters?: boolean
  searchDebounce?: number
  isMobile?: boolean
  presetFilters?: PresetFilter[]
  isLoading?: LoadingStates
  onFiltersChange?: (filters: ActiveFilters) => void
  onSortChange?: (sort: string) => void
  onSearchChange?: (search: string) => void
}

export function FilterSortControls({
  filterOptions,
  sortOptions,
  activeFilters = {},
  currentSort,
  searchValue = '',
  className,
  variant = 'default',
  showSearch = false,
  showActiveFilters = true,
  searchDebounce = 300,
  isMobile = false,
  presetFilters = [],
  isLoading = {},
  onFiltersChange,
  onSortChange,
  onSearchChange
}: FilterSortControlsProps) {
  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [localSearchValue, setLocalSearchValue] = useState(searchValue)
  const [searchFocused, setSearchFocused] = useState(false)

  const spacingClass = variant === 'compact' ? 'space-x-2' : 'space-x-4'

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (localSearchValue !== searchValue) {
        onSearchChange?.(localSearchValue)
      }
    }, searchDebounce)

    return () => clearTimeout(timeoutId)
  }, [localSearchValue, searchDebounce, onSearchChange, searchValue])

  // Sync external search value
  useEffect(() => {
    setLocalSearchValue(searchValue)
  }, [searchValue])

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    return Object.values(activeFilters).reduce((count, values) => count + values.length, 0)
  }, [activeFilters])

  // Get current sort label
  const currentSortLabel = useMemo(() => {
    return sortOptions.find(option => option.value === currentSort)?.label || 'Sort'
  }, [sortOptions, currentSort])

  // Handle filter change
  const handleFilterChange = (filterKey: string, value: string) => {
    const currentValues = activeFilters[filterKey] || []
    let newValues: string[]

    if (currentValues.includes(value)) {
      // Remove the filter
      newValues = currentValues.filter(v => v !== value)
    } else {
      // Add the filter
      newValues = [...currentValues, value]
    }

    const newFilters = {
      ...activeFilters,
      [filterKey]: newValues
    }

    // Remove empty filter arrays
    Object.keys(newFilters).forEach(key => {
      if (newFilters[key].length === 0) {
        delete newFilters[key]
      }
    })

    onFiltersChange?.(newFilters)
  }

  // Clear all filters
  const clearAllFilters = () => {
    onFiltersChange?.({})
  }

  // Remove specific filter
  const removeFilter = (filterKey: string, value: string) => {
    handleFilterChange(filterKey, value)
  }

  // Apply preset filter
  const applyPresetFilter = (preset: PresetFilter) => {
    onFiltersChange?.(preset.filters)
  }

  // Get filter option label
  const getFilterOptionLabel = (filterKey: string, value: string) => {
    const options = filterOptions[filterKey] || []
    return options.find(option => option.value === value)?.label || value
  }

  // Render filter chips
  const renderActiveFilterChips = () => {
    if (!showActiveFilters || activeFilterCount === 0) return null

    return (
      <div className="flex flex-wrap gap-2">
        {Object.entries(activeFilters).map(([filterKey, values]) =>
          values.map(value => (
            <div
              key={`${filterKey}-${value}`}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
            >
              <span className="capitalize">{filterKey}: {getFilterOptionLabel(filterKey, value)}</span>
              <button
                data-testid={`remove-filter-${filterKey}-${value}`}
                onClick={() => removeFilter(filterKey, value)}
                className="ml-2 hover:text-blue-900 focus:outline-none"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>
    )
  }

  // Render search input
  const renderSearchInput = () => {
    if (!showSearch) return null

    const isHidden = isMobile && !searchFocused && localSearchValue === ''

    return (
      <div 
        data-testid="search-container"
        className={cn(
          'relative flex-1 max-w-md',
          isHidden && 'hidden'
        )}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            data-testid="search-input"
            type="text"
            placeholder="Search contracts..."
            value={localSearchValue}
            onChange={(e) => setLocalSearchValue(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {localSearchValue && (
            <button
              data-testid="clear-search-button"
              onClick={() => {
                setLocalSearchValue('')
                onSearchChange?.('')
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {isLoading.search && (
            <div data-testid="search-loading" className="absolute right-8 top-1/2 transform -translate-y-1/2">
              <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Render filter dropdown
  const renderFiltersDropdown = () => {
    return (
      <div className="relative">
        <button
          data-testid="filters-button"
          onClick={() => setShowFiltersDropdown(!showFiltersDropdown)}
          disabled={isLoading.filters}
          tabIndex={0}
          aria-label="Filter contracts"
          aria-expanded={showFiltersDropdown}
          className={cn(
            'inline-flex items-center px-4 py-2 rounded-md text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
            activeFilterCount > 0 
              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
            isLoading.filters && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isLoading.filters ? (
            <RefreshCw data-testid="filters-loading" className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Filter className="h-4 w-4 mr-2" />
          )}
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span data-testid="active-filter-count" className="ml-2 px-1.5 py-0.5 rounded-full text-xs bg-white bg-opacity-20">
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
            </span>
          )}
          <ChevronDown className="h-4 w-4 ml-2" />
        </button>

        {showFiltersDropdown && (
          <div 
            data-testid="filters-dropdown"
            className="absolute left-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
          >
            <div className="p-4">
              {/* Clear all button */}
              {activeFilterCount > 0 && (
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                  <span className="text-sm font-medium text-gray-900">
                    {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={clearAllFilters}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Clear All
                  </button>
                </div>
              )}

              {/* Filter sections */}
              {Object.entries(filterOptions).map(([filterKey, options]) => (
                <div key={filterKey} className="mb-4 last:mb-0">
                  <h4 className="text-sm font-medium text-gray-900 mb-2 capitalize">
                    {filterKey}
                  </h4>
                  <div className="space-y-2">
                    {options.map((option) => {
                      const isSelected = (activeFilters[filterKey] || []).includes(option.value)
                      return (
                        <label
                          key={option.value}
                          className="flex items-center cursor-pointer hover:bg-gray-50 rounded p-1"
                          aria-label={`${option.label} (${option.count || 0})`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleFilterChange(filterKey, option.value)}
                            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700 flex-1">
                            {option.label}
                            {option.count !== undefined && (
                              <span className="text-gray-500"> ({option.count})</span>
                            )}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render sort dropdown
  const renderSortDropdown = () => {
    return (
      <div className="relative">
        <button
          data-testid="sort-button"
          onClick={() => setShowSortDropdown(!showSortDropdown)}
          disabled={isLoading.sort}
          tabIndex={0}
          aria-label="Sort contracts"
          aria-expanded={showSortDropdown}
          className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <SortAsc className="h-4 w-4 mr-2" />
          <span>{currentSortLabel}</span>
          <ChevronDown className="h-4 w-4 ml-2" />
        </button>

        {showSortDropdown && (
          <div 
            data-testid="sort-dropdown"
            className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
          >
            <div className="py-1">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onSortChange?.(option.value)
                    setShowSortDropdown(false)
                  }}
                  className={cn(
                    'w-full text-left px-4 py-2 text-sm hover:bg-gray-100',
                    currentSort === option.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render preset filters
  const renderPresetFilters = () => {
    if (presetFilters.length === 0) return null

    return (
      <div className="flex flex-wrap gap-2">
        {presetFilters.map((preset) => (
          <button
            key={preset.id}
            onClick={() => applyPresetFilter(preset)}
            className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>
    )
  }

  // Mobile layout
  if (isMobile) {
    return (
      <div className={cn('space-y-3', className)}>
        {/* Mobile controls */}
        <div className="flex items-center space-x-2">
          <button
            data-testid="mobile-filter-button"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium bg-white text-gray-700 border border-gray-300"
          >
            <Menu className="h-4 w-4 mr-2" />
            Filters & Sort
          </button>
          
          {showSearch && (
            <button
              onClick={() => setSearchFocused(true)}
              className="p-2 rounded-md bg-white border border-gray-300"
            >
              <Search className="h-4 w-4 text-gray-700" />
            </button>
          )}
        </div>

        {/* Mobile search (when focused) */}
        {renderSearchInput()}

        {/* Active filters */}
        {renderActiveFilterChips()}

        {/* Mobile dropdown */}
        {showMobileFilters && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
            {renderPresetFilters()}
            {renderFiltersDropdown()}
            {renderSortDropdown()}
          </div>
        )}
      </div>
    )
  }

  // Desktop layout
  return (
    <div className={cn('space-y-4', className)}>
      {/* Main controls */}
      <div 
        data-testid="filter-sort-container"
        className={cn('flex items-center justify-between', spacingClass)}
      >
        <div className={cn('flex items-center', spacingClass)}>
          {renderPresetFilters()}
          {renderFiltersDropdown()}
          {renderSortDropdown()}
        </div>
        
        {renderSearchInput()}
      </div>

      {/* Active filter chips */}
      {renderActiveFilterChips()}
    </div>
  )
}