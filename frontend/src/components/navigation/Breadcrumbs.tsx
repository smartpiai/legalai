/**
 * Breadcrumbs component
 * Provides navigation context and quick access to parent pages
 */
import { ReactNode, useState, useCallback, Fragment } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface BreadcrumbItem {
  label: string
  path: string
  icon?: ReactNode
  className?: string
  onClick?: (item: BreadcrumbItem) => void
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[]
  separator?: ReactNode
  className?: string
  maxItems?: number
  autoGenerate?: boolean
  routeMapping?: Record<string, string>
  excludePaths?: string[]
  isLoading?: boolean
}

export function Breadcrumbs({
  items: propItems,
  separator = '/',
  className,
  maxItems,
  autoGenerate = false,
  routeMapping = {},
  excludePaths = [],
  isLoading = false
}: BreadcrumbsProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [showAll, setShowAll] = useState(false)

  // Auto-generate breadcrumbs from current route
  const generateItemsFromRoute = useCallback(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean)
    const items: BreadcrumbItem[] = [
      { 
        label: routeMapping['/'] || 'Home', 
        path: '/' 
      }
    ]

    let currentPath = ''
    pathSegments.forEach((segment) => {
      currentPath += `/${segment}`
      
      // Skip excluded paths
      if (excludePaths.includes(currentPath)) {
        return
      }

      // Check for mapped label
      let label = segment
      
      // Check exact match first
      if (routeMapping[currentPath]) {
        label = routeMapping[currentPath]
      } else {
        // Check for pattern match (e.g., /contracts/:id)
        const patterns = Object.keys(routeMapping).filter(pattern => 
          pattern.includes(':')
        )
        
        for (const pattern of patterns) {
          const regex = new RegExp(
            pattern.replace(/:[^/]+/g, '[^/]+') + '$'
          )
          if (regex.test(currentPath)) {
            label = routeMapping[pattern]
            break
          }
        }
        
        // Capitalize first letter if no mapping found
        if (label === segment) {
          label = segment.charAt(0).toUpperCase() + segment.slice(1)
        }
      }

      items.push({ label, path: currentPath })
    })

    return items
  }, [location.pathname, routeMapping, excludePaths])

  // Determine which items to use
  const items = propItems || (autoGenerate ? generateItemsFromRoute() : [])

  // Handle item click
  const handleItemClick = useCallback((item: BreadcrumbItem, e: React.MouseEvent) => {
    e.preventDefault()
    
    if (item.onClick) {
      item.onClick(item)
    } else {
      navigate(item.path)
    }
  }, [navigate])

  // Loading skeleton
  if (isLoading) {
    return (
      <nav aria-label="Breadcrumb" className={cn('flex items-center space-x-2', className)}>
        <div data-testid="breadcrumbs-skeleton" className="flex items-center space-x-2">
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
          <span className="text-gray-400">/</span>
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          <span className="text-gray-400">/</span>
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
      </nav>
    )
  }

  if (!items || items.length === 0) {
    return null
  }

  // Determine which items to display based on maxItems
  let displayItems = items
  let hiddenItems: BreadcrumbItem[] = []
  
  if (maxItems && items.length > maxItems && !showAll) {
    displayItems = [
      items[0], // Always show first item (Home)
      ...items.slice(-(maxItems - 1)) // Show last n-1 items
    ]
    hiddenItems = items.slice(1, -(maxItems - 1))
  }

  // Render separator
  const renderSeparator = () => {
    if (typeof separator === 'string') {
      return <span className="mx-2 text-gray-400">{separator}</span>
    }
    if (separator === '/') {
      return <ChevronRight className="h-4 w-4 mx-1 text-gray-400" />
    }
    return separator
  }

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center', className)}>
      <ol className="flex items-center">
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1
          const isFirst = index === 0
          
          return (
            <Fragment key={item.path}>
              {/* Show ellipsis after first item if items are hidden */}
              {isFirst && hiddenItems.length > 0 && (
                <>
                  <li>
                    <Link
                      to={item.path}
                      onClick={(e) => handleItemClick(item, e)}
                      className={cn(
                        'inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600',
                        item.className
                      )}
                    >
                      {item.icon && <span className="mr-1">{item.icon}</span>}
                      {item.label}
                    </Link>
                  </li>
                  {renderSeparator()}
                  <li>
                    <button
                      onClick={() => setShowAll(!showAll)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ...
                    </button>
                  </li>
                  {renderSeparator()}
                </>
              )}
              
              {/* Regular items */}
              {(!isFirst || hiddenItems.length === 0) && (
                <li className="inline-flex items-center">
                  {isLast ? (
                    <span
                      aria-current="page"
                      className={cn(
                        'inline-flex items-center text-sm font-medium text-gray-500',
                        item.className
                      )}
                    >
                      {item.icon && <span className="mr-1">{item.icon}</span>}
                      {item.label}
                    </span>
                  ) : (
                    <>
                      <Link
                        to={item.path}
                        onClick={(e) => handleItemClick(item, e)}
                        className={cn(
                          'inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600',
                          item.className
                        )}
                      >
                        {item.icon && <span className="mr-1">{item.icon}</span>}
                        {item.label}
                      </Link>
                      {renderSeparator()}
                    </>
                  )}
                </li>
              )}
            </Fragment>
          )
        })}
        
        {/* Show hidden items when expanded */}
        {showAll && hiddenItems.map((item) => (
          <Fragment key={item.path}>
            <li className="inline-flex items-center">
              <Link
                to={item.path}
                onClick={(e) => handleItemClick(item, e)}
                className={cn(
                  'inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600',
                  item.className
                )}
              >
                {item.icon && <span className="mr-1">{item.icon}</span>}
                {item.label}
              </Link>
              {renderSeparator()}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}

// Convenience component for auto-generated breadcrumbs
export function AutoBreadcrumbs(props: Omit<BreadcrumbsProps, 'autoGenerate'>) {
  return <Breadcrumbs {...props} autoGenerate />
}