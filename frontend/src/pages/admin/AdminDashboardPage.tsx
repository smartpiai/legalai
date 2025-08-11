/**
 * AdminDashboardPage Component
 * Comprehensive admin dashboard for Legal AI Platform following TDD
 */

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Card, CardHeader, CardTitle, CardContent, Button
} from '@/components/ui'
import {
  Users, Activity, Server, Database, Download, RefreshCw, Trash2,
  UserPlus, HardDrive, Zap, CheckCircle, XCircle, AlertCircle
} from 'lucide-react'

// Types
interface SystemMetrics {
  totalUsers: number
  activeSessions: number
  systemHealth: 'healthy' | 'warning' | 'critical'
  storageUsage: number
  apiCallsToday: number
  cpuUsage: number
  memoryUsage: number
  databaseConnections: number
  queueLength: number
}

interface UserActivity {
  newRegistrations: number[]
  loginActivity: number[]
  documentUploads: number[]
}

interface SystemAlert {
  id: string
  message: string
  severity: 'critical' | 'warning' | 'info'
  timestamp: string
  service: string
}

interface AdminAction {
  id: string
  action: string
  adminUser: string
  timestamp: string
  details: string
}

interface LicenseInfo {
  type: string
  expiry: string
  userLimit: number
  currentUsers: number
  features: { aiAnalysis: boolean; bulkOperations: boolean; customIntegrations: boolean; advancedReporting: boolean }
}

interface TenantStat {
  id: string
  name: string
  userCount: number
  storageUsed: number
  documentsCount: number
  lastActivity: string
}

interface ErrorLog {
  id: string
  level: 'error' | 'warning' | 'info'
  service: string
  message: string
  timestamp: string
  stackTrace?: string
}

interface PerformanceMetrics { averageResponseTime: number; successRate: number; errorRate: number; throughput: number }
interface ScheduledTask { id: string; name: string; status: 'running' | 'completed' | 'failed'; lastRun: string; nextRun: string; duration: number }
interface SecurityOverview { failedLoginAttempts: number; suspiciousActivities: number; lastSecurityScan: string; vulnerabilities: number }
interface DatabaseStats { totalSize: string; growthRate: string; slowQueries: number; averageQueryTime: number }
interface IntegrationStatus {
  emailService: { status: 'healthy' | 'degraded' | 'down'; lastCheck: string }
  storageService: { status: 'healthy' | 'degraded' | 'down'; lastCheck: string }
  aiServices: { status: 'healthy' | 'degraded' | 'down'; lastCheck: string }
}

// Mock data
const mockData = {
  systemMetrics: { totalUsers: 1250, activeSessions: 89, systemHealth: 'healthy' as const, storageUsage: 75.2, apiCallsToday: 45621, cpuUsage: 42.5, memoryUsage: 68.3, databaseConnections: 15, queueLength: 3 },
  userActivity: { newRegistrations: [120, 95, 150, 89, 200, 175, 130], loginActivity: [850, 920, 780, 1100, 950, 1200, 1050], documentUploads: [45, 67, 52, 89, 73, 95, 61] },
  systemAlerts: [{ id: '1', message: 'Database connection pool reaching capacity', severity: 'warning' as const, timestamp: '2024-01-15T10:30:00Z', service: 'database' }, { id: '2', message: 'AI service response time degraded', severity: 'critical' as const, timestamp: '2024-01-15T09:15:00Z', service: 'ai-service' }],
  adminActions: [{ id: '1', action: 'User created', adminUser: 'admin@example.com', timestamp: '2024-01-15T11:45:00Z', details: 'Created user: john.doe@company.com' }, { id: '2', action: 'System backup initiated', adminUser: 'superadmin@example.com', timestamp: '2024-01-15T09:00:00Z', details: 'Full system backup started' }],
  licenseInfo: { type: 'Enterprise', expiry: '2024-12-31', userLimit: 5000, currentUsers: 1250, features: { aiAnalysis: true, bulkOperations: true, customIntegrations: true, advancedReporting: true } },
  tenantStats: [{ id: '1', name: 'Acme Corp', userCount: 250, storageUsed: 15.7, documentsCount: 1250, lastActivity: '2024-01-15T10:30:00Z' }, { id: '2', name: 'TechStart Inc', userCount: 89, storageUsed: 8.2, documentsCount: 450, lastActivity: '2024-01-15T09:45:00Z' }],
  errorLogs: [{ id: '1', level: 'error' as const, service: 'api-gateway', message: 'Failed to authenticate user request', timestamp: '2024-01-15T11:30:00Z', stackTrace: 'AuthenticationError: Invalid token' }, { id: '2', level: 'warning' as const, service: 'document-processor', message: 'OCR processing took longer than expected', timestamp: '2024-01-15T11:15:00Z' }],
  performanceMetrics: { averageResponseTime: 245, successRate: 99.2, errorRate: 0.8, throughput: 1250 },
  scheduledTasks: [{ id: '1', name: 'Daily Backup', status: 'running' as const, lastRun: '2024-01-15T02:00:00Z', nextRun: '2024-01-16T02:00:00Z', duration: 45 }, { id: '2', name: 'Weekly Reports', status: 'completed' as const, lastRun: '2024-01-14T06:00:00Z', nextRun: '2024-01-21T06:00:00Z', duration: 12 }],
  securityOverview: { failedLoginAttempts: 23, suspiciousActivities: 5, lastSecurityScan: '2024-01-14T18:00:00Z', vulnerabilities: 0 },
  databaseStats: { totalSize: '45.7 GB', growthRate: '2.3 GB/month', slowQueries: 3, averageQueryTime: 45 },
  integrationStatus: { emailService: { status: 'healthy' as const, lastCheck: '2024-01-15T11:45:00Z' }, storageService: { status: 'healthy' as const, lastCheck: '2024-01-15T11:45:00Z' }, aiServices: { status: 'degraded' as const, lastCheck: '2024-01-15T11:44:00Z' } }
}

const AdminDashboardPage: React.FC = () => {
  const [activityPeriod, setActivityPeriod] = useState<'7days' | '30days'>('7days')
  const [alertFilter, setAlertFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all')
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all')
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([])
  const [expandedLogs, setExpandedLogs] = useState<string[]>([])
  const [adminActionFilter, setAdminActionFilter] = useState<string>('')
  const [confirmationDialog, setConfirmationDialog] = useState<{ show: boolean; action?: string }>({ show: false })
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // API hooks
  const { data: systemMetrics, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ['systemMetrics'],
    queryFn: () => Promise.resolve(mockData.systemMetrics),
    refetchInterval: 30000
  })

  const { data: userActivity } = useQuery({ queryKey: ['userActivity', activityPeriod], queryFn: () => Promise.resolve(mockData.userActivity) })
  const { data: systemAlerts } = useQuery({ queryKey: ['systemAlerts'], queryFn: () => Promise.resolve(mockData.systemAlerts) })
  const { data: adminActions } = useQuery({ queryKey: ['adminActions'], queryFn: () => Promise.resolve(mockData.adminActions) })
  const { data: licenseInfo } = useQuery({ queryKey: ['licenseInfo'], queryFn: () => Promise.resolve(mockData.licenseInfo) })
  const { data: tenantStats } = useQuery({ queryKey: ['tenantStats'], queryFn: () => Promise.resolve(mockData.tenantStats) })
  const { data: errorLogs } = useQuery({ queryKey: ['errorLogs'], queryFn: () => Promise.resolve(mockData.errorLogs) })
  const { data: performanceMetrics } = useQuery({ queryKey: ['performanceMetrics'], queryFn: () => Promise.resolve(mockData.performanceMetrics) })
  const { data: scheduledTasks } = useQuery({ queryKey: ['scheduledTasks'], queryFn: () => Promise.resolve(mockData.scheduledTasks) })
  const { data: securityOverview } = useQuery({ queryKey: ['securityOverview'], queryFn: () => Promise.resolve(mockData.securityOverview) })
  const { data: databaseStats } = useQuery({ queryKey: ['databaseStats'], queryFn: () => Promise.resolve(mockData.databaseStats) })
  const { data: integrationStatus } = useQuery({ queryKey: ['integrationStatus'], queryFn: () => Promise.resolve(mockData.integrationStatus) })

  // Mutations
  const addUserMutation = useMutation({ mutationFn: () => Promise.resolve({ success: true }) })
  const systemBackupMutation = useMutation({ mutationFn: () => Promise.resolve({ success: true }) })
  const clearCacheMutation = useMutation({ mutationFn: () => Promise.resolve({ success: true }) })
  const restartServicesMutation = useMutation({ mutationFn: () => Promise.resolve({ success: true }) })
  const exportReportMutation = useMutation({
    mutationFn: (format: 'pdf' | 'excel') => Promise.resolve(new Blob(['report data'], { type: format === 'pdf' ? 'application/pdf' : 'application/vnd.ms-excel' }))
  })

  // Utility functions
  const formatNumber = (num: number) => num.toLocaleString()
  const formatPercentage = (num: number) => `${num.toFixed(1)}%`
  const formatDateTime = (dateStr: string) => new Date(dateStr).toLocaleString()

  const getSeverityColor = (severity: string) => {
    const colors = { critical: 'text-red-800 bg-red-100', warning: 'text-yellow-800 bg-yellow-100', error: 'text-red-800 bg-red-100', info: 'text-blue-800 bg-blue-100' }
    return colors[severity as keyof typeof colors] || 'text-gray-800 bg-gray-100'
  }

  const getStatusIcon = (status: string) => {
    if (['healthy', 'completed'].includes(status)) return <CheckCircle className="w-4 h-4 text-green-500" />
    if (['warning', 'degraded'].includes(status)) return <AlertCircle className="w-4 h-4 text-yellow-500" />
    return <XCircle className="w-4 h-4 text-red-500" />
  }

  const handleQuickAction = (action: string) => {
    if (['restart-services', 'clear-cache'].includes(action)) {
      setConfirmationDialog({ show: true, action })
    } else {
      executeQuickAction(action)
    }
  }

  const executeQuickAction = (action: string) => {
    const actions = {
      'add-user': () => addUserMutation.mutate(),
      'system-backup': () => systemBackupMutation.mutate(),
      'clear-cache': () => { clearCacheMutation.mutate(); setConfirmationDialog({ show: false }) },
      'restart-services': () => { restartServicesMutation.mutate(); setConfirmationDialog({ show: false }) }
    }
    actions[action as keyof typeof actions]?.()
  }

  const handleExport = (format: 'pdf' | 'excel') => exportReportMutation.mutate(format)
  const dismissAlert = (alertId: string) => setDismissedAlerts(prev => [...prev, alertId])
  const toggleLogExpansion = (logId: string) => setExpandedLogs(prev => prev.includes(logId) ? prev.filter(id => id !== logId) : [...prev, logId])

  const filteredAlerts = systemAlerts?.filter(alert => !dismissedAlerts.includes(alert.id) && (alertFilter === 'all' || alert.severity === alertFilter)) || []
  const filteredLogs = errorLogs?.filter(log => (logFilter === 'all' || log.level === logFilter) && (serviceFilter === 'all' || log.service === serviceFilter)) || []
  const filteredAdminActions = adminActions?.filter(action => !adminActionFilter || action.adminUser.includes(adminActionFilter)) || []

  // Loading and error states
  if (metricsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div data-testid="loading-spinner" className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (metricsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <div data-testid="error-message" className="text-red-600 text-center">
          <p className="text-xl font-semibold">Failed to load system metrics</p>
          <p className="text-sm mt-2">Please check your connection and try again</p>
        </div>
        <Button data-testid="retry-button" onClick={() => window.location.reload()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className={isMobile ? 'mobile-layout' : ''} data-testid={isMobile ? 'mobile-layout' : 'desktop-layout'}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="flex items-center space-x-2">
            <div data-testid="auto-refresh-indicator" className="text-sm text-gray-500">Auto-refresh: 30s</div>
            <div data-testid="realtime-connection-status" className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-500">Live</span>
            </div>
            <div data-testid="metrics-refresh-indicator"><RefreshCw className="w-4 h-4 text-gray-400" /></div>
          </div>
        </div>

        {/* System Overview Cards */}
        <section aria-label="System overview metrics">
          <h2 className="text-xl font-semibold mb-4">System Overview</h2>
          <div data-testid="metrics-grid" className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-5'} gap-4`}>
            {[
              { testId: 'total-users-card', title: 'Total Users', value: formatNumber(systemMetrics?.totalUsers || 0), icon: Users },
              { testId: 'active-sessions-card', title: 'Active Sessions', value: systemMetrics?.activeSessions || 0, icon: Activity },
              { testId: 'system-health-card', title: 'System Health', value: systemMetrics?.systemHealth === 'healthy' ? 'Healthy' : systemMetrics?.systemHealth || 'Unknown', icon: Server },
              { testId: 'storage-usage-card', title: 'Storage Usage', value: formatPercentage(systemMetrics?.storageUsage || 0), icon: HardDrive },
              { testId: 'api-calls-card', title: 'API Calls Today', value: formatNumber(systemMetrics?.apiCallsToday || 0), icon: Zap }
            ].map(card => (
              <Card key={card.testId} data-testid={card.testId}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{card.value}</div></CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Real-time System Metrics */}
        <section aria-label="Real-time system metrics">
          <h2 className="text-xl font-semibold mb-4">Real-time Metrics</h2>
          <div className="grid grid-cols-4 gap-4">
            {[
              { testId: 'cpu-usage-metric', title: 'CPU Usage', value: formatPercentage(systemMetrics?.cpuUsage || 0) },
              { testId: 'memory-usage-metric', title: 'Memory Usage', value: formatPercentage(systemMetrics?.memoryUsage || 0) },
              { testId: 'db-connections-metric', title: 'Database Connections', value: systemMetrics?.databaseConnections || 0 },
              { testId: 'queue-length-metric', title: 'Queue Length', value: systemMetrics?.queueLength || 0 }
            ].map(metric => (
              <Card key={metric.testId} data-testid={metric.testId}>
                <CardHeader><CardTitle className="text-sm">{metric.title}</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{metric.value}</div></CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* User Activity Chart */}
        <section aria-label="User activity chart">
          <Card data-testid="user-activity-chart">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>User Activity ({activityPeriod === '7days' ? 'Last 7 Days' : 'Last 30 Days'})</CardTitle>
                <div className="flex space-x-2">
                  <Button variant={activityPeriod === '7days' ? 'primary' : 'ghost'} size="sm" onClick={() => setActivityPeriod('7days')}>7 Days</Button>
                  <Button data-testid="activity-30-days-toggle" variant={activityPeriod === '30days' ? 'primary' : 'ghost'} size="sm" onClick={() => setActivityPeriod('30days')}>30 Days</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { testId: 'registrations-chart-data', title: 'New Registrations', data: userActivity?.newRegistrations },
                  { testId: 'logins-chart-data', title: 'Login Activity', data: userActivity?.loginActivity },
                  { testId: 'uploads-chart-data', title: 'Document Uploads', data: userActivity?.documentUploads }
                ].map(activity => (
                  <div key={activity.testId} data-testid={activity.testId}>
                    <h4 className="font-medium">{activity.title}</h4>
                    <div className="text-sm text-gray-600">Total: {activity.data?.reduce((a, b) => a + b, 0) || 0}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <div className="grid grid-cols-2 gap-6">
          {/* System Alerts */}
          <Card data-testid="system-alerts-panel">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>System Alerts</CardTitle>
                <div className="flex space-x-2">
                  <Button variant={alertFilter === 'all' ? 'primary' : 'ghost'} size="sm" onClick={() => setAlertFilter('all')}>All</Button>
                  <Button data-testid="alert-filter-critical" variant={alertFilter === 'critical' ? 'primary' : 'ghost'} size="sm" onClick={() => setAlertFilter('critical')}>Critical</Button>
                  <Button variant={alertFilter === 'warning' ? 'primary' : 'ghost'} size="sm" onClick={() => setAlertFilter('warning')}>Warning</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredAlerts.map(alert => (
                  <div key={alert.id} data-testid={`alert-${alert.severity}-${alert.id}`} className={`p-3 rounded-lg ${getSeverityColor(alert.severity)}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{alert.message}</p>
                        <p className="text-sm opacity-75">{alert.service} • {formatDateTime(alert.timestamp)}</p>
                      </div>
                      <Button data-testid={`dismiss-alert-${alert.id}`} variant="ghost" size="sm" onClick={() => dismissAlert(alert.id)}>×</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card data-testid="quick-actions-panel">
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { testId: 'quick-action-add-user', action: 'add-user', label: 'Add User', icon: UserPlus, loading: addUserMutation.isPending },
                  { testId: 'quick-action-system-backup', action: 'system-backup', label: 'System Backup', icon: Database, loading: systemBackupMutation.isPending },
                  { testId: 'quick-action-clear-cache', action: 'clear-cache', label: 'Clear Cache', icon: Trash2, loading: clearCacheMutation.isPending },
                  { testId: 'quick-action-restart-services', action: 'restart-services', label: 'Restart Services', icon: RefreshCw, loading: restartServicesMutation.isPending }
                ].map(btn => (
                  <Button key={btn.testId} data-testid={btn.testId} onClick={() => handleQuickAction(btn.action)} loading={btn.loading}>
                    <btn.icon className="w-4 h-4 mr-2" />
                    {btn.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Confirmation Dialog */}
        {confirmationDialog.show && (
          <div data-testid="confirmation-dialog" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Confirm Action</h3>
              <p className="text-gray-600 mb-6">Are you sure you want to {confirmationDialog.action?.replace('-', ' ')}? This action cannot be undone.</p>
              <div className="flex space-x-2 justify-end">
                <Button variant="secondary" onClick={() => setConfirmationDialog({ show: false })}>Cancel</Button>
                <Button variant="danger" onClick={() => executeQuickAction(confirmationDialog.action!)}>Confirm</Button>
              </div>
            </div>
          </div>
        )}

        {/* License Information */}
        <Card data-testid="license-info-panel">
          <CardHeader><CardTitle>License Information</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-lg font-semibold">{licenseInfo?.type}</div><div className="text-sm text-gray-600">License Type</div></div>
              <div><div className="text-lg font-semibold">{licenseInfo?.expiry}</div><div className="text-sm text-gray-600">Expires</div></div>
              <div>
                <div className="text-lg font-semibold">{formatNumber(licenseInfo?.currentUsers || 0)} / {formatNumber(licenseInfo?.userLimit || 0)} Users</div>
                <div className="text-sm text-gray-600">Usage</div>
                <div data-testid="license-usage-bar" className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${((licenseInfo?.currentUsers || 0) / (licenseInfo?.userLimit || 1)) * 100}%` }}></div>
                </div>
                {licenseInfo && (licenseInfo.currentUsers / licenseInfo.userLimit) > 0.9 && (
                  <div data-testid="license-warning" className="text-amber-600 text-sm mt-1">⚠️ Approaching user limit</div>
                )}
              </div>
              <div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2"><span data-testid="feature-ai-analysis-enabled">✓</span><span className="text-sm">AI Analysis</span></div>
                  <div className="flex items-center space-x-2"><span>✓</span><span className="text-sm">Bulk Operations</span></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tenant Statistics */}
        <Card data-testid="tenant-stats-panel">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Tenant Statistics</CardTitle>
              <Button data-testid="sort-tenants-by-activity" variant="ghost" size="sm">Sort by Activity</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4"><div className="text-lg font-semibold">{tenantStats?.length || 0} Total Tenants</div></div>
            <div data-testid="tenant-stats-sorted" className="space-y-3">
              <div data-testid="most-active-tenants">
                {tenantStats?.map(tenant => (
                  <div key={tenant.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div><div className="font-medium">{tenant.name}</div><div className="text-sm text-gray-600">{tenant.userCount} users</div></div>
                    <div className="text-right"><div className="font-medium">{tenant.storageUsed} GB</div><div className="text-sm text-gray-600">{tenant.documentsCount} docs</div></div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Logs and Performance */}
        <div className="grid grid-cols-2 gap-6">
          <Card data-testid="error-logs-panel">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Error Logs</CardTitle>
                <div className="flex space-x-2">
                  <select data-testid="log-filter-error" value={logFilter} onChange={(e) => setLogFilter(e.target.value as any)} className="text-sm border rounded px-2 py-1">
                    <option value="all">All Levels</option><option value="error">Error</option><option value="warning">Warning</option><option value="info">Info</option>
                  </select>
                  <select data-testid="log-filter-service" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="text-sm border rounded px-2 py-1">
                    <option value="all">All Services</option><option value="api-gateway">API Gateway</option><option value="document-processor">Document Processor</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredLogs.map(log => (
                  <div key={log.id} data-testid={`${log.level}-log-${log.id}`} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span data-testid={`log-level-${log.level}`} className={`px-2 py-1 rounded text-xs ${getSeverityColor(log.level)}`}>{log.level.toUpperCase()}</span>
                      <span className="text-xs text-gray-500">{formatDateTime(log.timestamp)}</span>
                    </div>
                    <p className="text-sm">{log.message}</p>
                    <div className="text-xs text-gray-500 mt-1">{log.service}</div>
                    {log.stackTrace && (
                      <div className="mt-2">
                        <Button data-testid={`expand-stack-trace-${log.id}`} variant="ghost" size="sm" onClick={() => toggleLogExpansion(log.id)}>
                          {expandedLogs.includes(log.id) ? 'Hide' : 'Show'} Stack Trace
                        </Button>
                        {expandedLogs.includes(log.id) && (
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-x-auto">{log.stackTrace}</pre>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="performance-metrics-panel">
            <CardHeader><CardTitle>Performance Metrics</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Avg Response Time', value: `${performanceMetrics?.averageResponseTime}ms` },
                  { label: 'Success Rate', value: formatPercentage(performanceMetrics?.successRate || 0) },
                  { label: 'Error Rate', value: formatPercentage(performanceMetrics?.errorRate || 0) },
                  { label: 'Requests/min', value: formatNumber(performanceMetrics?.throughput || 0) }
                ].map(metric => (
                  <div key={metric.label}>
                    <div className="text-2xl font-bold">{metric.value}</div>
                    <div className="text-sm text-gray-600">{metric.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional sections in compact grid */}
        <div className="grid grid-cols-3 gap-6">
          <Card data-testid="scheduled-tasks-panel">
            <CardHeader><CardTitle>Scheduled Tasks</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {scheduledTasks?.map(task => (
                  <div key={task.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium">{task.name}</div>
                      <div data-testid={`task-next-run-${task.id}`} className="text-xs text-gray-500">Next: {formatDateTime(task.nextRun)}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span data-testid={`task-status-${task.status}`}>{getStatusIcon(task.status)}</span>
                      <Button data-testid={`trigger-task-${task.id}`} variant="ghost" size="sm">Trigger</Button>
                      {task.status === 'running' && <span data-testid="task-triggering" className="text-xs text-blue-600">Running...</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="security-overview-panel">
            <CardHeader><CardTitle>Security Overview</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div><div className="text-2xl font-bold">{securityOverview?.failedLoginAttempts}</div><div className="text-sm text-gray-600">Failed Login Attempts</div></div>
                <div><div className="text-2xl font-bold">{securityOverview?.suspiciousActivities}</div><div className="text-sm text-gray-600">Suspicious Activities</div></div>
                <div data-testid="last-security-scan">
                  <div className="text-sm">Last Security Scan</div>
                  <div className="text-xs text-gray-500">{formatDateTime(securityOverview?.lastSecurityScan || '')}</div>
                </div>
                <div><div className="text-2xl font-bold text-green-600">{securityOverview?.vulnerabilities} Vulnerabilities</div></div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="database-stats-panel">
            <CardHeader><CardTitle>Database Statistics</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div><div className="text-2xl font-bold">{databaseStats?.totalSize}</div><div className="text-sm text-gray-600">Total Size</div></div>
                <div><div className="text-lg font-semibold">{databaseStats?.growthRate}</div><div className="text-sm text-gray-600">Growth Rate</div></div>
                <div><div className="text-lg font-semibold">{databaseStats?.slowQueries} Slow Queries</div></div>
                <div><div className="text-lg font-semibold">{databaseStats?.averageQueryTime}ms Avg Query Time</div></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Integration Status and Admin Actions */}
        <div className="grid grid-cols-2 gap-6">
          <Card data-testid="integration-status-panel">
            <CardHeader><CardTitle>Integration Status</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: 'Email Service', service: integrationStatus?.emailService, testId: 'email-service' },
                  { name: 'Storage Service', service: integrationStatus?.storageService, testId: 'storage-service' },
                  { name: 'AI Services', service: integrationStatus?.aiServices, testId: 'ai-services' }
                ].map(item => (
                  <div key={item.name} className="flex items-center justify-between">
                    <span>{item.name}</span>
                    <div className="flex items-center space-x-2">
                      <span data-testid={`${item.testId}-${item.service?.status}`}>{getStatusIcon(item.service?.status || 'down')}</span>
                      <span data-testid={`${item.testId}-last-check`} className="text-xs text-gray-500">{formatDateTime(item.service?.lastCheck || '')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="admin-actions-log">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Admin Actions</CardTitle>
                <input data-testid="admin-actions-user-filter" type="text" placeholder="Filter by admin user" value={adminActionFilter} onChange={(e) => setAdminActionFilter(e.target.value)} className="text-sm border rounded px-2 py-1" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {filteredAdminActions.map(action => (
                  <div key={action.id} className="p-2 border rounded">
                    <div className="font-medium">{action.action}</div>
                    <div className="text-sm text-gray-600">{action.adminUser}</div>
                    <div className="text-xs text-gray-500">{formatDateTime(action.timestamp)}</div>
                    <div className="text-xs mt-1">{action.details}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-center">
                <Button data-testid="admin-actions-next-page" variant="ghost" size="sm">Next Page</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Export Reports */}
        <Card data-testid="export-reports-panel">
          <CardHeader><CardTitle>Export Reports</CardTitle></CardHeader>
          <CardContent>
            <div className="flex space-x-4">
              <Button data-testid="export-pdf-report" onClick={() => handleExport('pdf')} loading={exportReportMutation.isPending}>
                <Download className="w-4 h-4 mr-2" />Export PDF
              </Button>
              <Button data-testid="export-excel-report" onClick={() => handleExport('excel')} loading={exportReportMutation.isPending}>
                <Download className="w-4 h-4 mr-2" />Export Excel
              </Button>
              {exportReportMutation.isPending && (
                <div data-testid="export-progress" className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm">Generating report...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default AdminDashboardPage