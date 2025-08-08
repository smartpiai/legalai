/**
 * ContractOverviewWidget component
 * Displays contract statistics and metrics in widget format
 */
import { ReactNode } from 'react'
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/utils/cn'

export interface ContractData {
  totalContracts: number
  activeContracts: number
  pendingReview: number
  expiringThisMonth: number
  draftContracts: number
  approvedContracts: number
  renewalsNeeded: number
  recentlyModified: number
  trends?: {
    [key: string]: {
      change: number
      direction: 'up' | 'down'
    }
  }
}

interface ContractOverviewWidgetProps {
  data?: ContractData
  isLoading?: boolean
  error?: string
  className?: string
  variant?: 'detailed' | 'compact'
  showPercentages?: boolean
  showTrends?: boolean
  showRefresh?: boolean
  lastUpdated?: Date
  onMetricClick?: (metric: string, value: number) => void
  onRefresh?: () => void
}

export function ContractOverviewWidget({
  data,
  isLoading = false,
  error,
  className,
  variant = 'detailed',
  showPercentages = false,
  showTrends = false,
  showRefresh = false,
  lastUpdated,
  onMetricClick,
  onRefresh
}: ContractOverviewWidgetProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-lg shadow p-6', className)}>
        <div data-testid="widget-skeleton" className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-8 bg-gray-200 rounded w-1/2" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
              </div>
            ))}
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

  // Empty state
  if (!data) {
    return (
      <div className={cn('bg-white rounded-lg shadow p-6', className)}>
        <div className="flex items-center justify-center text-gray-500">
          <FileText data-testid="empty-state-icon" className="h-8 w-8 mr-2" />
          <span>No contract data available</span>
        </div>
      </div>
    )
  }

  // Format number with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  // Calculate percentage
  const calculatePercentage = (value: number, total: number) => {
    if (total === 0) return '0'
    return ((value / total) * 100).toFixed(1)
  }

  // Render trend indicator
  const renderTrend = (metric: string) => {
    if (!showTrends || !data.trends?.[metric]) return null
    
    const trend = data.trends[metric]
    const isUp = trend.direction === 'up'
    const Icon = isUp ? TrendingUp : TrendingDown
    const colorClass = isUp ? 'text-green-600' : 'text-red-600'
    const sign = isUp ? '+' : ''
    
    return (
      <div className={cn('flex items-center text-xs ml-2', colorClass)}>
        <Icon 
          data-testid={`trend-${trend.direction}-icon`} 
          className="h-3 w-3 mr-1" 
        />
        <span>{sign}{trend.change}</span>
      </div>
    )
  }

  // Render metric card
  const renderMetric = (
    key: string,
    value: number,
    label: string,
    icon: ReactNode,
    colorClass = 'text-gray-600'
  ) => {
    const isClickable = !!onMetricClick
    const Component = isClickable ? 'button' : 'div'
    
    return (
      <Component
        key={key}
        className={cn(
          'p-4 rounded-lg border bg-white',
          isClickable && 'hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500',
          !isClickable && 'cursor-default'
        )}
        onClick={isClickable ? () => onMetricClick(key, value) : undefined}
        tabIndex={isClickable ? 0 : undefined}
      >
        <div className="flex items-center justify-between">
          <div className={cn('p-2 rounded-full', colorClass)}>
            {icon}
          </div>
          {renderTrend(key)}
        </div>
        <div className="mt-3">
          <div className="flex items-baseline">
            <p data-testid={key.replace(/([A-Z])/g, '-$1').toLowerCase()} className="text-2xl font-semibold text-gray-900">
              {formatNumber(value)}
            </p>
            {showPercentages && key === 'activeContracts' && (
              <span className="ml-2 text-sm text-gray-500">
                {calculatePercentage(value, data.totalContracts)}%
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">{label}</p>
        </div>
      </Component>
    )
  }

  const gridColsClass = variant === 'compact' ? 'grid-cols-4' : 'grid-cols-2'

  return (
    <div 
      className={cn('bg-white rounded-lg shadow', className)}
      data-testid="contract-overview-widget"
      role="region"
      aria-label="Contract overview statistics"
    >
      {/* Header */}
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Contract Overview</h3>
          {showRefresh && (
            <button
              data-testid="refresh-button"
              onClick={onRefresh}
              className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {lastUpdated && (
          <p className="text-xs text-gray-500 mt-1">
            Last updated: {lastUpdated.toLocaleString()}
          </p>
        )}
      </div>

      {/* Metrics Grid */}
      <div 
        data-testid="metrics-grid" 
        className={cn('p-6 grid gap-4', gridColsClass)}
      >
        {renderMetric(
          'totalContracts',
          data.totalContracts,
          'Total Contracts',
          <FileText className="h-5 w-5 text-blue-600" />,
          'bg-blue-100'
        )}
        
        {renderMetric(
          'activeContracts',
          data.activeContracts,
          'Active Contracts',
          <CheckCircle className="h-5 w-5 text-green-600" />,
          'bg-green-100'
        )}
        
        {renderMetric(
          'pendingReview',
          data.pendingReview,
          'Pending Review',
          <Clock className="h-5 w-5 text-orange-600" />,
          'bg-orange-100'
        )}
        
        {renderMetric(
          'expiringContracts',
          data.expiringThisMonth,
          'Expiring This Month',
          <AlertTriangle className="h-5 w-5 text-red-600" />,
          'bg-red-100'
        )}
        
        {variant === 'detailed' && (
          <>
            {renderMetric(
              'draftContracts',
              data.draftContracts,
              'Draft Contracts',
              <FileText className="h-5 w-5 text-gray-600" />,
              'bg-gray-100'
            )}
            
            {renderMetric(
              'approvedContracts',
              data.approvedContracts,
              'Approved Contracts',
              <CheckCircle className="h-5 w-5 text-green-600" />,
              'bg-green-100'
            )}
            
            {renderMetric(
              'renewalsNeeded',
              data.renewalsNeeded,
              'Renewals Needed',
              <RefreshCw className="h-5 w-5 text-yellow-600" />,
              'bg-yellow-100'
            )}
            
            {renderMetric(
              'recentlyModified',
              data.recentlyModified,
              'Recently Modified',
              <Clock className="h-5 w-5 text-purple-600" />,
              'bg-purple-100'
            )}
          </>
        )}
      </div>
    </div>
  )
}