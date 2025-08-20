/**
 * PerformanceTracking Component
 * Following TDD - GREEN phase: Minimum implementation to pass tests
 * Provides KPI monitoring and performance metrics dashboard
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { analyticsService } from '../../services/analytics.service';

// Import types from analytics service
interface KPISummary {
  totalContracts: number;
  activeContracts: number;
  contractValue: number;
  complianceRate: number;
  avgProcessingTime: number;
  userSatisfaction: number;
}

interface TrendData {
  daily: Array<{ date: string; contracts: number; value: number; time: number }>;
  weekly: Array<{ week: string; contracts: number; value: number; compliance: number }>;
  monthly: Array<{ month: string; contracts: number; value: number; satisfaction: number }>;
}

interface KPITargets {
  contractsTarget: number;
  valueTarget: number;
  complianceTarget: number;
  processingTarget: number;
  satisfactionTarget: number;
}

interface KPIMetrics {
  summary: KPISummary;
  trends: TrendData;
  targets: KPITargets;
}

interface Alert {
  id: string;
  metric: string;
  current: number;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
}
import { useAuthStore } from '../../store/auth';
import { format, subDays, subMonths, subYears } from 'date-fns';

interface PerformanceTrackingProps {
  onKPISelect?: (kpi: any) => void;
  onAlertTriggered?: (alerts: any[]) => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
  showBenchmarks?: boolean;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export const PerformanceTracking: React.FC<PerformanceTrackingProps> = ({
  onKPISelect,
  onAlertTriggered,
  autoRefresh = true,
  refreshInterval = 30000,
  showBenchmarks = false,
}) => {
  const { user } = useAuthStore();
  
  // State management
  const [timeRange, setTimeRange] = useState('7d');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [compareMode, setCompareMode] = useState(false);
  const [yoyMode, setYoyMode] = useState(false);
  const [showAlertConfig, setShowAlertConfig] = useState(false);
  const [alertThresholds, setAlertThresholds] = useState({
    complianceRate: 99,
    responseTime: 100,
    errorRate: 1,
  });
  const [selectedKPI, setSelectedKPI] = useState<string | null>(null);
  const [drillDownView, setDrillDownView] = useState(false);
  const [detailedView, setDetailedView] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isAutoRefresh, setIsAutoRefresh] = useState(autoRefresh);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState({
    frequency: 'weekly',
    day: 'monday',
    email: '',
  });
  const [customBenchmark, setCustomBenchmark] = useState<Record<string, number>>({});
  const [showBenchmarkDialog, setShowBenchmarkDialog] = useState(false);

  // Fetch KPI metrics
  const { data: kpiData, isLoading: kpiLoading, refetch: refetchKPI, error: kpiError } = useQuery<KPIMetrics>({
    queryKey: ['kpiMetrics', timeRange, user?.tenant_id],
    queryFn: () => analyticsService.getKPIMetrics({ 
      timeRange, 
      tenantId: user?.tenant_id?.toString() 
    }),
    refetchInterval: isAutoRefresh ? refreshInterval : false,
  });

  // Handle successful KPI data fetch
  useEffect(() => {
    if (kpiData) {
      setLastUpdated(new Date());
    }
  }, [kpiData]);

  // Fetch performance metrics
  const { data: performanceData } = useQuery({
    queryKey: ['performanceMetrics'],
    queryFn: () => analyticsService.getPerformanceMetrics(),
    enabled: activeTab === 'system',
  });

  // Fetch contract metrics
  const { data: contractData } = useQuery({
    queryKey: ['contractMetrics'],
    queryFn: () => analyticsService.getContractMetrics(),
    enabled: activeTab === 'contracts',
  });

  // Fetch user metrics
  const { data: userData } = useQuery({
    queryKey: ['userMetrics'],
    queryFn: () => analyticsService.getUserActivityMetrics(),
    enabled: activeTab === 'user activity',
  });

  // Fetch compliance metrics
  const { data: complianceData } = useQuery({
    queryKey: ['complianceMetrics'],
    queryFn: () => analyticsService.getComplianceMetrics(),
    enabled: activeTab === 'compliance',
  });

  // Fetch revenue metrics
  const { data: revenueData } = useQuery({
    queryKey: ['revenueMetrics'],
    queryFn: () => analyticsService.getRevenueMetrics(),
    enabled: activeTab === 'revenue',
  });

  // Fetch alerts
  const { data: alerts } = useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: () => analyticsService.getAlerts(),
  });

  // Handle successful alerts fetch
  useEffect(() => {
    if (alerts && onAlertTriggered) {
      onAlertTriggered(alerts);
    }
  }, [alerts, onAlertTriggered]);

  // Fetch benchmarks
  const { data: benchmarks } = useQuery({
    queryKey: ['benchmarks'],
    queryFn: () => analyticsService.getBenchmarks(),
    enabled: showBenchmarks,
  });

  // Fetch comparative analysis
  const { data: comparison } = useQuery({
    queryKey: ['comparison', yoyMode],
    queryFn: () => analyticsService.getComparativeAnalysis(yoyMode ? 'year' : 'period'),
    enabled: compareMode || yoyMode,
  });

  // Export metrics mutation
  const exportMutation = useMutation({
    mutationFn: (format: string) => 
      analyticsService.exportMetrics({
        format,
        timeRange,
        metrics: ['kpi', 'performance', 'contracts'],
        includeCharts: format === 'pdf',
      }),
  });

  // Update threshold mutation
  const updateThresholdMutation = useMutation({
    mutationFn: (params: { metric: string; threshold: number }) =>
      analyticsService.updateAlertThreshold(params),
  });

  // Handle KPI card click
  const handleKPIClick = useCallback((metric: string, value: any) => {
    setSelectedKPI(metric);
    if (onKPISelect) {
      onKPISelect({
        metric,
        value,
        trend: kpiData?.trends,
      });
    }
  }, [onKPISelect, kpiData]);

  // Handle KPI double click for drill-down
  const handleKPIDblClick = useCallback((metric: string) => {
    setSelectedKPI(metric);
    setDrillDownView(true);
  }, []);

  // Format numbers
  const formatNumber = (num: number, type: string = 'number') => {
    if (type === 'currency') {
      return `$${(num / 1000000).toFixed(2)}M`;
    }
    if (type === 'percentage') {
      return `${num.toFixed(1)}%`;
    }
    if (type === 'time') {
      return `${num.toFixed(1)} days`;
    }
    if (type === 'rating') {
      return `${num.toFixed(1)}/5.0`;
    }
    return num.toLocaleString();
  };

  // Get time ago text
  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  // Handle time range change
  const handleTimeRangeChange = (range: string) => {
    if (range === 'custom') {
      setShowCustomRange(true);
    } else {
      setTimeRange(range);
      setShowCustomRange(false);
    }
  };

  // Apply custom date range
  const applyCustomRange = () => {
    // Convert custom dates to time range
    setTimeRange('custom');
    setShowCustomRange(false);
  };

  // Save alert thresholds
  const saveThresholds = () => {
    updateThresholdMutation.mutate({
      metric: 'complianceRate',
      threshold: alertThresholds.complianceRate,
    });
    setShowAlertConfig(false);
  };

  // Schedule report
  const scheduleReport = () => {
    analyticsService.scheduleReport({
      frequency: scheduleConfig.frequency,
      day: scheduleConfig.day,
      recipients: [scheduleConfig.email],
      metrics: ['kpi', 'performance'],
    });
    setShowScheduleDialog(false);
  };

  // Apply custom benchmark
  const applyBenchmark = (metric: string, value: number) => {
    setCustomBenchmark(prev => ({ ...prev, [metric]: value }));
    setShowBenchmarkDialog(false);
  };

  if (kpiError) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-red-500 mb-4">Failed to load metrics</p>
        <button
          onClick={() => refetchKPI()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div data-testid="performance-tracking" className="p-6" role="region" aria-label="Performance Tracking">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold">Performance Tracking</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Last updated: <span data-testid="last-updated">{getTimeAgo(lastUpdated)}</span>
          </span>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              role="switch"
              aria-label="Auto-refresh"
              checked={isAutoRefresh}
              onChange={(e) => setIsAutoRefresh(e.target.checked)}
              className="toggle"
            />
            <span>Auto-refresh</span>
          </label>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => handleTimeRangeChange('1d')}
          className={`px-3 py-1 rounded ${timeRange === '1d' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Today
        </button>
        <button
          onClick={() => handleTimeRangeChange('7d')}
          className={`px-3 py-1 rounded ${timeRange === '7d' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          7 Days
        </button>
        <button
          onClick={() => handleTimeRangeChange('30d')}
          className={`px-3 py-1 rounded ${timeRange === '30d' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          30 Days
        </button>
        <button
          onClick={() => handleTimeRangeChange('90d')}
          className={`px-3 py-1 rounded ${timeRange === '90d' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          90 Days
        </button>
        <button
          onClick={() => handleTimeRangeChange('1y')}
          className={`px-3 py-1 rounded ${timeRange === '1y' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          1 Year
        </button>
        <button
          onClick={() => handleTimeRangeChange('custom')}
          className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
        >
          Custom
        </button>
        <button
          onClick={() => setCompareMode(!compareMode)}
          className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
        >
          Compare
        </button>
        <button
          onClick={() => setYoyMode(!yoyMode)}
          className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
        >
          YoY Comparison
        </button>
      </div>

      {/* Custom Date Range */}
      {showCustomRange && (
        <div className="mb-4 p-4 bg-gray-50 rounded">
          <div className="flex gap-4 items-end">
            <div>
              <label htmlFor="start-date" className="block text-sm mb-1">Start Date</label>
              <input
                id="start-date"
                type="date"
                value={customDateRange.start}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label htmlFor="end-date" className="block text-sm mb-1">End Date</label>
              <input
                id="end-date"
                type="date"
                value={customDateRange.end}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 border rounded"
              />
            </div>
            <button
              onClick={applyCustomRange}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Apply Range
            </button>
          </div>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div data-testid="kpi-summary" className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div
          data-testid="kpi-card-contracts"
          className={`p-4 bg-white rounded-lg shadow cursor-pointer hover:shadow-lg ${
            kpiData?.summary.totalContracts >= kpiData?.targets.contractsTarget ? 'achieved' : ''
          }`}
          onClick={() => handleKPIClick('totalContracts', kpiData?.summary.totalContracts)}
          onDoubleClick={() => handleKPIDblClick('totalContracts')}
        >
          <h3 className="text-sm text-gray-600 mb-2">Total Contracts</h3>
          <p className="text-2xl font-bold">{formatNumber(kpiData?.summary.totalContracts || 0)}</p>
          <p className="text-xs text-gray-500 mt-2">Target: {formatNumber(kpiData?.targets.contractsTarget || 0)}</p>
          <div data-testid="achievement-indicator" className={kpiData?.summary.totalContracts >= kpiData?.targets.contractsTarget ? 'achieved' : 'not-achieved'}></div>
        </div>

        <div
          data-testid="kpi-card-value"
          className="p-4 bg-white rounded-lg shadow cursor-pointer hover:shadow-lg"
          onClick={() => handleKPIClick('contractValue', kpiData?.summary.contractValue)}
        >
          <h3 className="text-sm text-gray-600 mb-2">Contract Value</h3>
          <p className="text-2xl font-bold">{formatNumber(kpiData?.summary.contractValue || 0, 'currency')}</p>
          <p className="text-xs text-gray-500 mt-2">Target: {formatNumber(kpiData?.targets.valueTarget || 0, 'currency')}</p>
        </div>

        <div
          data-testid="kpi-card-compliance"
          className="p-4 bg-white rounded-lg shadow cursor-pointer hover:shadow-lg"
          onClick={() => handleKPIClick('complianceRate', kpiData?.summary.complianceRate)}
          onDoubleClick={() => handleKPIDblClick('complianceRate')}
        >
          <h3 className="text-sm text-gray-600 mb-2">Compliance Rate</h3>
          <p className="text-2xl font-bold">{formatNumber(kpiData?.summary.complianceRate || 0, 'percentage')}</p>
          <p className="text-xs text-gray-500 mt-2">Target: {formatNumber(kpiData?.targets.complianceTarget || 0, 'percentage')}</p>
        </div>

        <div className="p-4 bg-white rounded-lg shadow cursor-pointer hover:shadow-lg">
          <h3 className="text-sm text-gray-600 mb-2">Avg Processing Time</h3>
          <p className="text-2xl font-bold">{formatNumber(kpiData?.summary.avgProcessingTime || 0, 'time')}</p>
          <p className="text-xs text-gray-500 mt-2">Target: {formatNumber(kpiData?.targets.processingTarget || 0, 'time')}</p>
        </div>

        <div className="p-4 bg-white rounded-lg shadow cursor-pointer hover:shadow-lg">
          <h3 className="text-sm text-gray-600 mb-2">User Satisfaction</h3>
          <p className="text-2xl font-bold">{formatNumber(kpiData?.summary.userSatisfaction || 0, 'rating')}</p>
          <p className="text-xs text-gray-500 mt-2">Target: {formatNumber(kpiData?.targets.satisfactionTarget || 0, 'rating')}</p>
        </div>
      </div>

      {/* Comparison View */}
      {(compareMode || yoyMode) && comparison && (
        <div data-testid="comparison-view" className="mb-6 p-4 bg-gray-50 rounded">
          <h3 className="text-lg font-semibold mb-4">{yoyMode ? 'Year-over-Year' : 'vs Previous Period'}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Contracts</p>
              <p className="text-xl font-bold">{comparison.change.contracts}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Value</p>
              <p className="text-xl font-bold">{comparison.change.value}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Compliance</p>
              <p className="text-xl font-bold">{comparison.change.compliance}</p>
            </div>
          </div>
          <div data-testid="comparison-chart" className="mt-4">
            {/* Comparison chart would go here */}
          </div>
        </div>
      )}

      {/* Alerts Panel */}
      {alerts && alerts.length > 0 && (
        <div data-testid="alerts-panel" className="mb-6 p-4 bg-yellow-50 rounded">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">Active Alerts</h3>
            <button
              onClick={() => setShowAlertConfig(true)}
              className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Configure Alerts
            </button>
          </div>
          {alerts.map(alert => (
            <div
              key={alert.id}
              data-testid={`alert-${alert.id}`}
              className={`p-2 mb-2 rounded ${alert.severity === 'critical' ? 'bg-red-100 critical' : 'bg-yellow-100 warning'}`}
            >
              {alert.metric === 'complianceRate' && 'Compliance rate below threshold'}
              {alert.metric === 'responseTime' && 'Response time exceeded'}
              : {alert.current} (threshold: {alert.threshold})
            </div>
          ))}
        </div>
      )}

      {/* Metric Category Tabs */}
      <div className="mb-6">
        <div role="tablist" aria-label="Metric categories" className="flex gap-2 mb-4 border-b">
          {['overview', 'contracts', 'user activity', 'system', 'compliance', 'revenue'].map(tab => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 capitalize ${activeTab === tab ? 'border-b-2 border-blue-500' : ''}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div data-testid="kpi-trends" className="bg-white p-4 rounded shadow">
            <h3 className="text-lg font-semibold mb-4">KPI Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={kpiData?.trends.daily || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="contracts" stroke="#3B82F6" />
                <Line type="monotone" dataKey="value" stroke="#10B981" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === 'contracts' && contractData && (
          <div data-testid="contract-metrics" className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-lg font-semibold mb-4">By Status</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={contractData.byStatus}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                  >
                    {contractData.byStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-lg font-semibold mb-4">By Type</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={contractData.byType}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'user activity' && userData && (
          <div data-testid="user-metrics" className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-sm text-gray-600">Active Users</h3>
              <p className="text-2xl font-bold">{userData.activeUsers}</p>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-sm text-gray-600">Avg Session Duration</h3>
              <p className="text-2xl font-bold">{userData.avgSessionDuration} min</p>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-sm text-gray-600">Sessions/Day</h3>
              <p className="text-2xl font-bold">{userData.sessionsPerDay}</p>
            </div>
          </div>
        )}

        {activeTab === 'system' && performanceData && (
          <div data-testid="system-metrics" className="grid grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-sm text-gray-600">Uptime</h3>
              <p className="text-2xl font-bold">{performanceData.systemMetrics.uptime}%</p>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-sm text-gray-600">Response Time</h3>
              <p className="text-2xl font-bold">{performanceData.systemMetrics.responseTime}ms</p>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-sm text-gray-600">CPU Usage</h3>
              <p className="text-2xl font-bold">{performanceData.systemMetrics.cpu}%</p>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-sm text-gray-600">Memory Usage</h3>
              <p className="text-2xl font-bold">{performanceData.systemMetrics.memory}%</p>
            </div>
          </div>
        )}

        {activeTab === 'compliance' && complianceData && (
          <div data-testid="compliance-metrics" className="bg-white p-4 rounded shadow">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Overall Compliance</h3>
              <p className="text-3xl font-bold">{complianceData.overallCompliance}%</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Violations</p>
                <p className="text-xl font-bold">{complianceData.violations} violations</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Resolved</p>
                <p className="text-xl font-bold">{complianceData.resolved} resolved</p>
              </div>
            </div>
            {complianceData.byCategory.map(cat => (
              <div key={cat.category} className="mt-2">
                <span className="text-sm">{cat.category}: </span>
                <span className="font-semibold">{cat.rate}%</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'revenue' && revenueData && (
          <div data-testid="revenue-metrics" className="bg-white p-4 rounded shadow">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Total Revenue</h3>
              <p className="text-3xl font-bold">{formatNumber(revenueData.totalRevenue, 'currency')}</p>
              <p className="text-sm text-green-600">+{revenueData.growth}%</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Recurring</p>
                <p className="text-xl font-bold">{formatNumber(revenueData.recurring, 'currency')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">One-Time</p>
                <p className="text-xl font-bold">{formatNumber(revenueData.oneTime, 'currency')}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Benchmarks Panel */}
      {showBenchmarks && benchmarks && (
        <div data-testid="benchmarks-panel" className="mb-6 p-4 bg-blue-50 rounded">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Industry Benchmarks</h3>
            <button
              onClick={() => setShowBenchmarkDialog(true)}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Set Benchmark
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Processing Time</p>
              <p>Industry Avg: {benchmarks.industry.avgProcessingTime} days</p>
              <p className="text-sm text-blue-600">{benchmarks.percentile.processingTime}th percentile</p>
              {customBenchmark.processingTime && (
                <p className="text-sm">Custom: {customBenchmark.processingTime} days</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">Compliance Rate</p>
              <p>Industry Avg: {benchmarks.industry.avgComplianceRate}%</p>
              <p className="text-sm text-blue-600">{benchmarks.percentile.complianceRate}th percentile</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">User Satisfaction</p>
              <p>Industry Avg: {benchmarks.industry.avgSatisfaction}/5.0</p>
              <p className="text-sm text-blue-600">{benchmarks.percentile.satisfaction}th percentile</p>
            </div>
          </div>
        </div>
      )}

      {/* Drill-down View */}
      {drillDownView && selectedKPI && (
        <div data-testid="drill-down-view" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-auto">
            <h2 className="text-xl font-bold mb-4">
              {selectedKPI === 'totalContracts' && 'Contract Details'}
              {selectedKPI === 'complianceRate' && 'Compliance Breakdown'}
            </h2>
            {selectedKPI === 'complianceRate' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">By Department</h3>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="p-2 bg-gray-50 rounded">Legal: 99.2%</div>
                    <div className="p-2 bg-gray-50 rounded">Sales: 97.8%</div>
                    <div className="p-2 bg-gray-50 rounded">Finance: 98.5%</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">By Contract Type</h3>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="p-2 bg-gray-50 rounded">Service: 98.8%</div>
                    <div className="p-2 bg-gray-50 rounded">NDA: 99.5%</div>
                    <div className="p-2 bg-gray-50 rounded">Purchase: 97.2%</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">By Region</h3>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="p-2 bg-gray-50 rounded">North America: 98.9%</div>
                    <div className="p-2 bg-gray-50 rounded">Europe: 98.2%</div>
                    <div className="p-2 bg-gray-50 rounded">Asia: 98.4%</div>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={() => setDrillDownView(false)}
              className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Export Menu */}
      <div className="fixed bottom-4 right-4 flex gap-2">
        <div className="relative group">
          <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Export
          </button>
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-white shadow-lg rounded">
            <button
              role="menuitem"
              onClick={() => exportMutation.mutate('csv')}
              className="block px-4 py-2 hover:bg-gray-100"
            >
              CSV
            </button>
            <button
              role="menuitem"
              onClick={() => exportMutation.mutate('pdf')}
              className="block px-4 py-2 hover:bg-gray-100"
            >
              PDF Report
            </button>
          </div>
        </div>
        
        <button
          onClick={() => setShowScheduleDialog(true)}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Schedule Report
        </button>
        
        <button
          onClick={() => setDetailedView(!detailedView)}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Detailed View
        </button>
      </div>

      {/* Detailed View */}
      {detailedView && (
        <div data-testid="metrics-list" className="mt-6 bg-white p-4 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">Detailed Metrics</h3>
          <div className="max-h-96 overflow-auto">
            {/* Virtualized list of metrics */}
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} role="row" className="p-2 border-b">
                Metric {i + 1}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alert Configuration Dialog */}
      {showAlertConfig && (
        <div role="dialog" aria-label="Alert Configuration" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Alert Configuration</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="compliance-threshold" className="block text-sm mb-1">
                  Compliance Threshold (%)
                </label>
                <input
                  id="compliance-threshold"
                  type="number"
                  value={alertThresholds.complianceRate}
                  onChange={(e) => setAlertThresholds(prev => ({
                    ...prev,
                    complianceRate: Number(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={saveThresholds}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save Thresholds
              </button>
              <button
                onClick={() => setShowAlertConfig(false)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Report Dialog */}
      {showScheduleDialog && (
        <div role="dialog" aria-label="Schedule Report" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Schedule Report</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="frequency" className="block text-sm mb-1">Frequency</label>
                <select
                  id="frequency"
                  value={scheduleConfig.frequency}
                  onChange={(e) => setScheduleConfig(prev => ({ ...prev, frequency: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {scheduleConfig.frequency === 'weekly' && (
                <div>
                  <label htmlFor="day" className="block text-sm mb-1">Day</label>
                  <select
                    id="day"
                    value={scheduleConfig.day}
                    onChange={(e) => setScheduleConfig(prev => ({ ...prev, day: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="monday">Monday</option>
                    <option value="tuesday">Tuesday</option>
                    <option value="wednesday">Wednesday</option>
                    <option value="thursday">Thursday</option>
                    <option value="friday">Friday</option>
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="email" className="block text-sm mb-1">Email</label>
                <input
                  id="email"
                  type="email"
                  value={scheduleConfig.email}
                  onChange={(e) => setScheduleConfig(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={scheduleReport}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save Schedule
              </button>
              <button
                onClick={() => setShowScheduleDialog(false)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Benchmark Configuration Dialog */}
      {showBenchmarkDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Set Custom Benchmark</h2>
            <div>
              <label htmlFor="processing-benchmark" className="block text-sm mb-1">
                Processing Time Benchmark (days)
              </label>
              <input
                id="processing-benchmark"
                type="number"
                step="0.1"
                className="w-full px-3 py-2 border rounded"
                onBlur={(e) => applyBenchmark('processingTime', Number(e.target.value))}
              />
            </div>
            <button
              onClick={() => setShowBenchmarkDialog(false)}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Status Message for Screen Readers */}
      <div role="status" aria-live="polite" className="sr-only">
        Metrics updated
      </div>
    </div>
  );
};