/**
 * HomePage Component - Main Dashboard
 * Comprehensive dashboard with stats, activities, and quick actions
 */
import { useEffect, useState, useMemo, memo, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Plus,
  Upload,
  BarChart3,
  Search,
  Bell,
  RefreshCw,
  Calendar,
  Users,
  Folder,
  TrendingUp,
  AlertCircle,
  ExternalLink
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useDashboardStore } from '@/stores/dashboardStore'
import { dashboardService } from '@/services/dashboard.service'
import { contractService } from '@/services/contract.service'
import { ContractOverviewWidget, type ContractData } from '@/components/contracts/ContractOverviewWidget'
import { RecentActivityFeed, type ActivityItem } from '@/components/contracts/RecentActivityFeed'
import { QuickActionButtons } from '@/components/contracts/QuickActionButtons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

// Lazy loaded components for performance
const LazyContractOverviewWidget = memo(ContractOverviewWidget)
const LazyRecentActivityFeed = memo(RecentActivityFeed)

interface StatsCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: {
    value: number
    direction: 'up' | 'down'
  }
  onClick?: () => void
  loading?: boolean
  testId: string
}

function StatsCard({ title, value, icon, trend, onClick, loading, testId }: StatsCardProps) {
  if (loading) {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="animate-pulse" data-testid="stats-skeleton">
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-2" />
            <div className="h-6 bg-gray-200 rounded w-3/4" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const CardComponent = onClick ? 'button' : 'div'

  return (
    <Card clickable={!!onClick} onClick={onClick} data-testid={testId}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 rounded-full bg-blue-100">
                {icon}
              </div>
              {trend && (
                <div className={cn(
                  'flex items-center text-sm',
                  trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
                )}>
                  <TrendingUp className={cn(
                    'h-4 w-4 mr-1',
                    trend.direction === 'down' && 'rotate-180'
                  )} />
                  <span>{Math.abs(trend.value)}%</span>
                </div>
              )}
            </div>
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
            <p className="text-sm text-gray-600">{title}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface NotificationsSummaryProps {
  notifications: Array<{
    id: string
    title: string
    message: string
    type: 'info' | 'warning' | 'error' | 'success'
    read: boolean
    timestamp: string
  }>
  loading?: boolean
  onViewAll: () => void
}

function NotificationsSummary({ notifications, loading, onViewAll }: NotificationsSummaryProps) {
  const unreadCount = notifications.filter(n => !n.read).length

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3" />
          </div>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span 
                data-testid="unread-count" 
                className="bg-red-500 text-white text-xs px-2 py-1 rounded-full"
              >
                {unreadCount}
              </span>
            )}
          </CardTitle>
          <button
            data-testid="view-all-notifications"
            onClick={onViewAll}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
          >
            View All
            <ExternalLink className="h-4 w-4 ml-1" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {unreadCount === 0 ? (
          <p className="text-gray-600 text-sm">No new notifications</p>
        ) : (
          <div className="space-y-2">
            {notifications.slice(0, 3).map(notification => (
              <div key={notification.id} className="flex items-start space-x-2 p-2 rounded-md bg-gray-50">
                <div className={cn(
                  'w-2 h-2 rounded-full mt-2',
                  notification.type === 'warning' && 'bg-yellow-500',
                  notification.type === 'error' && 'bg-red-500',
                  notification.type === 'success' && 'bg-green-500',
                  notification.type === 'info' && 'bg-blue-500'
                )} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                  <p className="text-xs text-gray-600">{notification.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface RecentDocumentsProps {
  contracts: Array<{
    id: string
    title: string
    updated_at: string
    contract_type: string
  }>
  loading?: boolean
}

function RecentDocuments({ contracts, loading }: RecentDocumentsProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3" />
          </div>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Documents</CardTitle>
      </CardHeader>
      <CardContent>
        <div data-testid="recent-documents-list" className="space-y-3">
          {contracts.slice(0, 5).map(contract => (
            <div key={contract.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50">
              <FileText className="h-4 w-4 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{contract.title}</p>
                <p className="text-xs text-gray-600">
                  {new Date(contract.updated_at).toLocaleDateString()} • {contract.contract_type}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface UpcomingDeadlinesProps {
  expiringCount: number
  loading?: boolean
  onClick?: () => void
}

function UpcomingDeadlines({ expiringCount, loading, onClick }: UpcomingDeadlinesProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3" />
          </div>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card clickable={!!onClick} onClick={onClick}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calendar className="h-5 w-5" />
          <span>Upcoming Deadlines</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold text-gray-900">{expiringCount}</p>
            <p className="text-sm text-gray-600">contracts expiring soon</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface NavigationShortcutsProps {
  onNavigate: (path: string) => void
}

function NavigationShortcuts({ onNavigate }: NavigationShortcutsProps) {
  const shortcuts = [
    { label: 'Contracts', path: '/contracts', icon: FileText, testId: 'contracts-shortcut' },
    { label: 'Templates', path: '/templates', icon: Folder, testId: 'templates-shortcut' },
    { label: 'Reports', path: '/reports', icon: BarChart3, testId: 'reports-shortcut' },
    { label: 'Users', path: '/admin/users', icon: Users, testId: 'users-shortcut' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Access</CardTitle>
      </CardHeader>
      <CardContent>
        <div data-testid="nav-shortcuts" className="grid grid-cols-2 gap-2">
          {shortcuts.map(shortcut => {
            const Icon = shortcut.icon
            return (
              <button
                key={shortcut.path}
                data-testid={shortcut.testId}
                onClick={() => onNavigate(shortcut.path)}
                className="flex items-center space-x-2 p-3 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <Icon className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-900">{shortcut.label}</span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const {
    executiveSummary,
    contractMetrics,
    recentActivities,
    notifications,
    isLoading,
    error,
    lastUpdated,
    fetchExecutiveSummary,
    fetchContractMetrics,
    fetchRecentActivities,
    fetchNotifications,
    refreshAllData
  } = useDashboardStore()

  const [refreshing, setRefreshing] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Fetch recent contracts using React Query
  const {
    data: recentContracts,
    isLoading: contractsLoading,
    error: contractsError
  } = useQuery({
    queryKey: ['recent-contracts'],
    queryFn: () => contractService.getContracts({ limit: 5, offset: 0 }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.allSettled([
          fetchExecutiveSummary(),
          fetchContractMetrics(),
          fetchRecentActivities(10),
          fetchNotifications()
        ])
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      }
    }

    loadData()
  }, [fetchExecutiveSummary, fetchContractMetrics, fetchRecentActivities, fetchNotifications])

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshAllData()
    } finally {
      setRefreshing(false)
    }
  }

  // Handle retry on error
  const handleRetry = async () => {
    await handleRefresh()
  }

  // Quick actions handler
  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'new-contract':
        navigate('/contracts/new')
        break
      case 'upload-document':
        navigate('/documents/upload')
        break
      case 'view-reports':
        navigate('/reports')
        break
      case 'search':
        navigate('/search')
        break
      default:
        break
    }
  }

  // Navigation handlers
  const handleStatsCardClick = (type: string) => {
    navigate('/contracts')
  }

  const handleActivityClick = (activity: ActivityItem) => {
    if (activity.entity.type === 'contract') {
      navigate(`/contracts/${activity.entity.id}`)
    }
  }

  const handleViewAllActivities = () => {
    navigate('/dashboard?tab=activities')
  }

  const handleViewAllNotifications = () => {
    navigate('/notifications')
  }

  const handleNavigateShortcut = (path: string) => {
    navigate(path)
  }

  // Transform data for ContractOverviewWidget
  const contractOverviewData: ContractData | undefined = useMemo(() => {
    if (!executiveSummary || !contractMetrics) return undefined

    return {
      totalContracts: executiveSummary.total_contracts,
      activeContracts: executiveSummary.active_contracts,
      pendingReview: contractMetrics.by_status.pending || 0,
      expiringThisMonth: executiveSummary.expiring_soon,
      draftContracts: contractMetrics.by_status.draft || 0,
      approvedContracts: contractMetrics.by_status.active || 0,
      renewalsNeeded: executiveSummary.expiring_soon,
      recentlyModified: executiveSummary.recent_activities,
    }
  }, [executiveSummary, contractMetrics])

  // Check user permissions
  const canCreateContract = user?.permissions?.includes('contracts:create') ?? false

  // Render mobile layout
  if (isMobile) {
    return (
      <div data-testid="mobile-layout" className="space-y-4">
        {/* Mobile content */}
        <div data-testid="home-page" className="min-h-screen bg-gray-50 p-4">
          <div className="space-y-4">
            {/* Welcome Section */}
            <div data-testid="welcome-section" className="bg-white rounded-lg p-4 shadow">
              <h1 className="text-xl font-bold text-gray-900">Welcome back, {user?.full_name}</h1>
              <p className="text-sm text-gray-600 mt-1">{new Date().toLocaleDateString()}</p>
            </div>

            {/* Stats Grid - Mobile */}
            <div data-testid="stats-cards-grid" className="grid grid-cols-2 gap-3">
              <StatsCard
                testId="total-contracts-card"
                title="Total Contracts"
                value={executiveSummary?.total_contracts || 0}
                icon={<FileText className="h-5 w-5 text-blue-600" />}
                onClick={() => handleStatsCardClick('total')}
                loading={isLoading}
              />
              <StatsCard
                testId="active-contracts-card"
                title="Active Contracts"
                value={executiveSummary?.active_contracts || 0}
                icon={<CheckCircle className="h-5 w-5 text-green-600" />}
                onClick={() => handleStatsCardClick('active')}
                loading={isLoading}
              />
              <StatsCard
                testId="pending-reviews-card"
                title="Pending Reviews"
                value={contractMetrics?.by_status.pending || 0}
                icon={<Clock className="h-5 w-5 text-orange-600" />}
                onClick={() => handleStatsCardClick('pending')}
                loading={isLoading}
              />
              <StatsCard
                testId="upcoming-renewals-card"
                title="Upcoming Renewals"
                value={executiveSummary?.expiring_soon || 0}
                icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
                onClick={() => handleStatsCardClick('expiring')}
                loading={isLoading}
              />
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              {canCreateContract && (
                <button
                  data-testid="new-contract-button"
                  onClick={() => handleQuickAction('new-contract')}
                  className="flex items-center justify-center space-x-2 p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Contract</span>
                </button>
              )}
              <button
                data-testid="upload-document-button"
                onClick={() => handleQuickAction('upload-document')}
                className="flex items-center justify-center space-x-2 p-4 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Upload className="h-4 w-4" />
                <span>Upload</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Desktop layout
  return (
    <div data-testid="home-page" className="space-y-6">
      <main role="main" aria-label="Legal Dashboard">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div data-testid="welcome-section">
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-lg text-gray-600 mt-1">
                Welcome back, {user?.full_name || 'User'}
              </p>
              <p className="text-sm text-gray-500">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {lastUpdated && (
                <span className="text-sm text-gray-500">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <button
                data-testid="refresh-dashboard-button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 text-gray-400 hover:text-gray-600 bg-white rounded-lg shadow hover:shadow-md transition-all disabled:opacity-50"
                aria-label="Refresh dashboard data"
              >
                <RefreshCw className={cn('h-5 w-5', refreshing && 'animate-spin')} />
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div data-testid="error-message" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <span className="text-red-700">{error}</span>
              </div>
              <button
                data-testid="retry-button"
                onClick={handleRetry}
                className="text-red-600 hover:text-red-800 underline text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards Grid */}
        <div 
          role="region" 
          aria-label="Contract statistics" 
          data-testid="stats-cards-grid" 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} data-testid="skeleton-loader">
                <StatsCard
                  testId={`skeleton-${i}`}
                  title="Loading..."
                  value="--"
                  icon={<FileText className="h-5 w-5 text-gray-400" />}
                  loading
                />
              </div>
            ))
          ) : (
            <>
              <StatsCard
                testId="total-contracts-card"
                title="Total Contracts"
                value={executiveSummary?.total_contracts || 0}
                icon={<FileText className="h-5 w-5 text-blue-600" />}
                onClick={() => handleStatsCardClick('total')}
              />
              <StatsCard
                testId="active-contracts-card"
                title="Active Contracts"
                value={executiveSummary?.active_contracts || 0}
                icon={<CheckCircle className="h-5 w-5 text-green-600" />}
                onClick={() => handleStatsCardClick('active')}
              />
              <StatsCard
                testId="pending-reviews-card"
                title="Pending Reviews"
                value={contractMetrics?.by_status.pending || 0}
                icon={<Clock className="h-5 w-5 text-orange-600" />}
                onClick={() => handleStatsCardClick('pending')}
              />
              <StatsCard
                testId="upcoming-renewals-card"
                title="Upcoming Renewals"
                value={executiveSummary?.expiring_soon || 0}
                icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
                onClick={() => handleStatsCardClick('expiring')}
              />
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            {canCreateContract && (
              <button
                data-testid="new-contract-button"
                onClick={() => handleQuickAction('new-contract')}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Contract
              </button>
            )}
            <button
              data-testid="upload-document-button"
              onClick={() => handleQuickAction('upload-document')}
              className="inline-flex items-center px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </button>
            <button
              data-testid="view-reports-button"
              onClick={() => handleQuickAction('view-reports')}
              className="inline-flex items-center px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              View Reports
            </button>
            <button
              data-testid="search-button"
              onClick={() => handleQuickAction('search')}
              className="inline-flex items-center px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              <Search className="h-4 w-4 mr-2" />
              Search
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div data-testid="main-content-area" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Primary Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Contract Overview Widget */}
            <div role="region" aria-label="Contract overview">
              <Suspense fallback={<div data-testid="contract-overview-skeleton">Loading...</div>}>
                <div data-testid="contract-overview-widget">
                  <LazyContractOverviewWidget
                    data={contractOverviewData}
                    isLoading={!executiveSummary || !contractMetrics}
                    error={error}
                    onMetricClick={(metric, value) => handleStatsCardClick(metric)}
                    showRefresh
                    onRefresh={handleRefresh}
                    lastUpdated={lastUpdated}
                  />
                </div>
              </Suspense>
            </div>

            {/* Recent Activity Feed */}
            <div role="region" aria-label="Recent activity">
              <Suspense fallback={<div data-testid="activity-feed-skeleton">Loading activities...</div>}>
                <div data-testid="recent-activity-feed">
                  <LazyRecentActivityFeed
                    activities={(recentActivities || []).map(activity => ({
                      ...activity,
                      timestamp: new Date(activity.timestamp)
                    }))}
                    isLoading={isLoading}
                    error={error ? 'Failed to load recent activities' : undefined}
                    maxItems={5}
                    showViewAll
                    onActivityClick={handleActivityClick}
                    onViewAll={handleViewAllActivities}
                    showRefresh
                    onRefresh={() => fetchRecentActivities(10)}
                  />
                </div>
              </Suspense>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-8">
            {/* Notifications Summary */}
            <NotificationsSummary
              notifications={notifications || []}
              loading={isLoading}
              onViewAll={handleViewAllNotifications}
            />

            {/* Recent Documents */}
            <RecentDocuments
              contracts={recentContracts?.items || []}
              loading={contractsLoading}
            />

            {/* Upcoming Deadlines */}
            <UpcomingDeadlines
              expiringCount={executiveSummary?.expiring_soon || 0}
              loading={isLoading}
              onClick={() => navigate('/contracts?filter=expiring')}
            />

            {/* Navigation Shortcuts */}
            <NavigationShortcuts onNavigate={handleNavigateShortcut} />
          </div>
        </div>
      </main>
    </div>
  )
}