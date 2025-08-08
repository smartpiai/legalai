/**
 * RecentActivityFeed component
 * Displays recent activity and events related to contracts
 */
import { ReactNode, useEffect, useState } from 'react'
import { 
  FileText, 
  CheckCircle, 
  Upload, 
  Play, 
  RefreshCw,
  AlertCircle,
  Clock,
  Filter,
  Eye
} from 'lucide-react'
import { cn } from '@/utils/cn'

export interface ActivityItem {
  id: string
  type: 'contract_created' | 'contract_approved' | 'document_uploaded' | 'workflow_started' | 'contract_updated' | 'contract_expired'
  title: string
  description: string
  user: {
    name: string
    avatar?: string | null
  }
  timestamp: Date
  metadata?: Record<string, any>
}

interface RecentActivityFeedProps {
  activities?: ActivityItem[]
  isLoading?: boolean
  isRefreshing?: boolean
  error?: string
  className?: string
  variant?: 'detailed' | 'compact'
  maxItems?: number
  showFilters?: boolean
  showRefresh?: boolean
  showViewAll?: boolean
  enableAutoRefresh?: boolean
  autoRefreshInterval?: number
  filterType?: string
  emptyMessage?: string
  newActivityIds?: string[]
  loadingItemIds?: string[]
  onActivityClick?: (activity: ActivityItem) => void
  onFilterChange?: (filterType: string) => void
  onRefresh?: () => void
  onViewAll?: () => void
}

export function RecentActivityFeed({
  activities = [],
  isLoading = false,
  isRefreshing = false,
  error,
  className,
  variant = 'detailed',
  maxItems,
  showFilters = false,
  showRefresh = false,
  showViewAll = false,
  enableAutoRefresh = false,
  autoRefreshInterval = 30000,
  filterType,
  emptyMessage = 'No recent activity',
  newActivityIds = [],
  loadingItemIds = [],
  onActivityClick,
  onFilterChange,
  onRefresh,
  onViewAll
}: RecentActivityFeedProps) {
  const [currentFilter, setCurrentFilter] = useState<string>('all')

  // Auto-refresh functionality
  useEffect(() => {
    if (!enableAutoRefresh || !onRefresh) return

    const interval = setInterval(() => {
      onRefresh()
    }, autoRefreshInterval)

    return () => clearInterval(interval)
  }, [enableAutoRefresh, autoRefreshInterval, onRefresh])

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-lg shadow', className)}>
        <div data-testid="activity-feed-skeleton" className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start space-x-3">
                  <div className="h-10 w-10 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={cn('bg-white rounded-lg shadow p-6', className)}>
        <div className="flex items-center justify-center text-red-600">
          <AlertCircle data-testid="error-icon" className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      </div>
    )
  }

  // Filter activities
  const filteredActivities = activities.filter(activity => {
    if (filterType) {
      return activity.type.includes(filterType)
    }
    if (currentFilter === 'all') return true
    return activity.type.includes(currentFilter)
  })

  // Limit activities
  const displayActivities = maxItems 
    ? filteredActivities.slice(0, maxItems)
    : filteredActivities

  // Get activity icon and color
  const getActivityIcon = (type: string) => {
    const iconProps = { className: "h-5 w-5" }
    
    switch (type) {
      case 'contract_created':
        return <FileText {...iconProps} className={cn(iconProps.className, 'text-blue-600')} />
      case 'contract_approved':
        return <CheckCircle {...iconProps} className={cn(iconProps.className, 'text-green-600')} />
      case 'document_uploaded':
        return <Upload {...iconProps} className={cn(iconProps.className, 'text-purple-600')} />
      case 'workflow_started':
        return <Play {...iconProps} className={cn(iconProps.className, 'text-orange-600')} />
      case 'contract_updated':
        return <FileText {...iconProps} className={cn(iconProps.className, 'text-yellow-600')} />
      case 'contract_expired':
        return <AlertCircle {...iconProps} className={cn(iconProps.className, 'text-red-600')} />
      default:
        return <Clock {...iconProps} className={cn(iconProps.className, 'text-gray-600')} />
    }
  }

  // Format relative time
  const formatRelativeTime = (timestamp: Date) => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) {
      return `${minutes} minutes ago`
    } else if (hours < 24) {
      return `${hours} hours ago`
    } else {
      return `${days} days ago`
    }
  }

  // Get user initials
  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Render user avatar
  const renderUserAvatar = (user: ActivityItem['user'], activityId: string) => {
    if (user.avatar) {
      return (
        <img
          data-testid={`user-avatar-${activityId}`}
          src={user.avatar}
          alt={user.name}
          className="h-10 w-10 rounded-full object-cover"
        />
      )
    }

    return (
      <div 
        data-testid={`user-initials-${activityId}`}
        className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium text-gray-700"
      >
        {getUserInitials(user.name)}
      </div>
    )
  }

  // Render activity item
  const renderActivityItem = (activity: ActivityItem, index: number) => {
    const isClickable = !!onActivityClick
    const isNew = newActivityIds.includes(activity.id)
    const isLoadingItem = loadingItemIds.includes(activity.id)
    const Component = isClickable ? 'button' : 'div'

    if (isLoadingItem) {
      return (
        <div key={activity.id} data-testid="activity-item-skeleton" className="flex items-start space-x-3 p-4">
          <div className="animate-pulse">
            <div className="h-10 w-10 bg-gray-200 rounded-full" />
          </div>
          <div className="flex-1 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      )
    }

    return (
      <Component
        key={activity.id}
        data-testid={`activity-item-${activity.id}`}
        className={cn(
          'w-full text-left p-4 rounded-lg transition-colors',
          isClickable && 'hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500',
          isNew && 'ring-2 ring-blue-500 bg-blue-50',
          variant === 'compact' ? 'p-3' : 'p-4'
        )}
        onClick={isClickable ? () => onActivityClick(activity) : undefined}
        tabIndex={isClickable ? 0 : undefined}
      >
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="relative">
              {renderUserAvatar(activity.user, activity.id)}
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1">
                <div data-testid={`activity-icon-${activity.type}`}>
                  {getActivityIcon(activity.type)}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                <div className="flex items-center mt-2 text-xs text-gray-500">
                  <span>{activity.user.name}</span>
                  <span className="mx-1">•</span>
                  <span>{formatRelativeTime(activity.timestamp)}</span>
                </div>
              </div>
              {isNew && (
                <div className="flex-shrink-0 ml-2">
                  <div className="h-2 w-2 bg-blue-600 rounded-full" />
                </div>
              )}
            </div>
          </div>
        </div>
      </Component>
    )
  }

  // Empty state
  if (displayActivities.length === 0 && !isLoading) {
    return (
      <div className={cn('bg-white rounded-lg shadow p-6', className)}>
        <div className="text-center">
          <div className="flex items-center justify-center">
            <Clock data-testid="empty-activity-icon" className="h-12 w-12 text-gray-400" />
          </div>
          <p className="mt-2 text-sm text-gray-600">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  const spacingClass = variant === 'compact' ? 'space-y-2' : 'space-y-1'

  return (
    <div 
      className={cn('bg-white rounded-lg shadow', className)}
      role="region"
      aria-label="Recent activity feed"
    >
      {/* Header */}
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
          <div className="flex items-center space-x-2">
            {showFilters && (
              <div data-testid="activity-filters" className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  value={currentFilter}
                  onChange={(e) => {
                    setCurrentFilter(e.target.value)
                    onFilterChange?.(e.target.value)
                  }}
                  className="text-sm border-gray-300 rounded-md"
                >
                  <option value="all">All Activities</option>
                  <option value="contract">Contracts</option>
                  <option value="document">Documents</option>
                  <option value="workflow">Workflows</option>
                </select>
              </div>
            )}
            
            {showRefresh && (
              <button
                data-testid="refresh-button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded disabled:opacity-50"
              >
                {isRefreshing ? (
                  <RefreshCw data-testid="refresh-spinner" className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div data-testid="activity-feed" className={cn('p-6 pt-4', spacingClass)}>
        {displayActivities.map((activity, index) => renderActivityItem(activity, index))}
      </div>

      {/* View All Button */}
      {showViewAll && maxItems && filteredActivities.length > maxItems && (
        <div className="px-6 pb-6">
          <button
            onClick={onViewAll}
            className="w-full flex items-center justify-center px-4 py-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <Eye className="h-4 w-4 mr-2" />
            View All Activities
          </button>
        </div>
      )}
    </div>
  )
}